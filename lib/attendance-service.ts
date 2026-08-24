/**
 * Unified attendance-event pipeline.
 *
 * Every path that records attendance (browser camera, Python agent, manual
 * admin entry) MUST go through registerAttendanceEvent so the same rules
 * apply regardless of capture device:
 *
 *  - tenant scoping (student must belong to the caller's school)
 *  - school must be operational (not suspended/cancelled/expired trial)
 *  - minConfidence from school settings enforced for automatic sources
 *  - 60s cooldown for automatic sources (DB-backed, multi-camera safe)
 *  - 1 ENTRY + 1 EXIT per LOCAL day (school timezone), enforced atomically
 *    via the (studentId, eventType, dayKey) unique index
 *  - EXIT re-registration only moves the time FORWARD (late offline syncs
 *    can't overwrite a newer exit), and its ATRASO/SAIDA_ANTECIPADA note is
 *    recomputed for the new time
 *  - notifications respect notifyOnEntry/notifyOnExit and carry the
 *    late/early-exit context; `notified` is only set once a push was
 *    actually accepted
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { notifyParentsOfStudent, formatAttendanceNotification } from '@/lib/notifications';
import { resolveSchedule, computeStatus, type AttendanceStatus } from '@/lib/attendance-rules';
import { DEFAULT_TIMEZONE, dayRangeInTz, localMinutes } from '@/lib/timezone';

const COOLDOWN_SECONDS = 60;

export type EventSource = 'CAMERA_WEB' | 'AGENT' | 'MANUAL';

export interface RegisterEventInput {
  studentId: string;
  eventType: 'ENTRY' | 'EXIT';
  source: EventSource;
  /** Tenant scope — when provided, the student MUST belong to this school. */
  schoolId?: string;
  deviceId?: string | null;
  confidence?: number | null;
  photoUrl?: string | null;
  timestamp?: Date;
  /** Manual only: explicit note ('ATRASO' | 'SAIDA_ANTECIPADA' | free text). */
  explicitNotes?: string | null;
  /** Manual only: replace the existing same-type event for the day. */
  override?: boolean;
  actorUserId?: string | null;
  actorName?: string | null;
}

export interface EventStudentInfo {
  id: string;
  name: string;
  photoUrl: string | null;
}

export type RegisterEventResult =
  | {
      ok: true;
      created: boolean;
      updated: boolean;
      event: { id: string; eventType: string; timestamp: Date; notes: string | null };
      status: AttendanceStatus;
      student: EventStudentInfo;
    }
  | {
      ok: false;
      code:
        | 'STUDENT_NOT_FOUND'
        | 'SCHOOL_INACTIVE'
        | 'LOW_CONFIDENCE'
        | 'COOLDOWN'
        | 'DUPLICATE_ENTRY'
        | 'STALE_EXIT';
      message: string;
      httpStatus: number;
      existingEventId?: string;
      student?: EventStudentInfo;
    };

const VALID_EXPLICIT_NOTES = ['ATRASO', 'SAIDA_ANTECIPADA'];

/** Only URLs the web app can actually render. Local device paths are useless server-side. */
function sanitizePhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (/^https?:\/\//.test(photoUrl) || photoUrl.startsWith('/')) return photoUrl;
  return null;
}

export async function registerAttendanceEvent(
  input: RegisterEventInput
): Promise<RegisterEventResult> {
  const {
    studentId, eventType, source, schoolId, deviceId,
    confidence, explicitNotes, override, actorUserId, actorName,
  } = input;
  const isManual = source === 'MANUAL';
  const timestamp = input.timestamp ?? new Date();
  const photoUrl = sanitizePhotoUrl(input.photoUrl);

  // ── Load student + tenant context in one query ─────────────────────────
  const student = await prisma.student.findFirst({
    where: { id: studentId, ...(schoolId ? { schoolId } : {}) },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      isActive: true,
      schoolId: true,
      class: { select: { shift: true } },
      school: {
        select: {
          name: true,
          status: true,
          settings: {
            select: {
              entryStartTime: true, entryEndTime: true,
              exitStartTime: true, exitEndTime: true,
              shiftSchedules: true, timezone: true,
              minConfidence: true, notifyOnEntry: true, notifyOnExit: true,
            },
          },
          subscription: { select: { status: true, trialEndsAt: true } },
        },
      },
    },
  });

  if (!student || !student.isActive) {
    return { ok: false, code: 'STUDENT_NOT_FOUND', message: 'Aluno não encontrado.', httpStatus: 404 };
  }

  const studentInfo: EventStudentInfo = { id: student.id, name: student.name, photoUrl: student.photoUrl };
  const school = student.school;
  const settings = school.settings;

  // ── School must be operational ─────────────────────────────────────────
  const trialExpired =
    school.status === 'TRIAL' &&
    school.subscription?.trialEndsAt != null &&
    school.subscription.trialEndsAt < new Date();

  if (school.status === 'SUSPENDED' || school.status === 'CANCELLED' || trialExpired) {
    return {
      ok: false, code: 'SCHOOL_INACTIVE', httpStatus: 403,
      message: trialExpired ? 'Período de teste expirado.' : 'Escola suspensa ou cancelada.',
      student: studentInfo,
    };
  }

  // ── Confidence threshold (automatic sources only) ──────────────────────
  const minConfidence = settings?.minConfidence ?? 0.9;
  if (!isManual && confidence != null && confidence < minConfidence) {
    return {
      ok: false, code: 'LOW_CONFIDENCE', httpStatus: 422,
      message: `Confiança ${(confidence * 100).toFixed(0)}% abaixo do mínimo (${(minConfidence * 100).toFixed(0)}%).`,
      student: studentInfo,
    };
  }

  const tz = settings?.timezone || DEFAULT_TIMEZONE;
  const day = dayRangeInTz(timestamp, tz);

  // ── Cooldown (automatic sources; DB-backed → multi-camera safe) ────────
  if (!isManual) {
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_SECONDS * 1000);
    const recentEvent = await prisma.attendanceEvent.findFirst({
      where: { studentId, eventType, timestamp: { gte: cooldownCutoff } },
      select: { id: true },
    });
    if (recentEvent) {
      return {
        ok: false, code: 'COOLDOWN', httpStatus: 200,
        message: 'cooldown', existingEventId: recentEvent.id, student: studentInfo,
      };
    }
  }

  // ── Status + notes for THIS timestamp (school-local time) ──────────────
  const schedule = resolveSchedule(student.class?.shift, settings ?? null);
  const status = computeStatus(schedule, eventType, localMinutes(timestamp, tz));
  const autoNote = status === 'ATRASO' || status === 'SAIDA_ANTECIPADA' ? status : null;

  let notes: string | null;
  if (explicitNotes && VALID_EXPLICIT_NOTES.includes(explicitNotes)) {
    notes = explicitNotes;
  } else if (autoNote) {
    notes = autoNote;
  } else if (explicitNotes) {
    notes = explicitNotes;
  } else if (isManual) {
    notes = `Registro manual por ${actorName || 'admin'}`;
  } else {
    notes = null;
  }

  // ── Existing same-type event for the local day ─────────────────────────
  // Matched by timestamp range (covers legacy rows without dayKey too).
  const existing = await prisma.attendanceEvent.findFirst({
    where: { studentId, eventType, timestamp: { gte: day.start, lt: day.end } },
    orderBy: { timestamp: 'desc' },
  });

  const notify = async (eventId: string, eventTime: Date) => {
    const wantsPush = eventType === 'ENTRY'
      ? settings?.notifyOnEntry ?? true
      : settings?.notifyOnExit ?? true;
    if (!wantsPush) return;
    const payload = formatAttendanceNotification(student.name, eventType, eventTime, school.name, notes);
    notifyParentsOfStudent(studentId, payload)
      .then((sent) => {
        if (sent > 0) {
          return prisma.attendanceEvent.update({ where: { id: eventId }, data: { notified: true } });
        }
      })
      .catch(console.error);
  };

  const audit = async (action: string, eventId: string) => {
    if (!isManual) return;
    await prisma.auditLog.create({
      data: {
        userId: actorUserId ?? null,
        action,
        entityType: 'AttendanceEvent',
        entityId: eventId,
        metadata: JSON.stringify({ studentId, eventType, notes, studentName: student.name, override: !!override }),
      },
    }).catch(() => {});
  };

  // ── ENTRY ──────────────────────────────────────────────────────────────
  if (eventType === 'ENTRY' && existing) {
    if (isManual && override) {
      const updated = await prisma.attendanceEvent.update({
        where: { id: existing.id },
        data: { notes, timestamp, isManual: true, dayKey: day.dateStr },
      });
      await audit('MANUAL_CHECKIN_OVERRIDE', updated.id);
      return {
        ok: true, created: false, updated: true, status,
        event: { id: updated.id, eventType: updated.eventType, timestamp: updated.timestamp, notes: updated.notes },
        student: studentInfo,
      };
    }
    return {
      ok: false, code: 'DUPLICATE_ENTRY', httpStatus: 200,
      message: 'Entrada já registrada hoje.', existingEventId: existing.id, student: studentInfo,
    };
  }

  // ── EXIT (re-registration moves time forward only) ─────────────────────
  if (eventType === 'EXIT' && existing) {
    const allowUpdate = (isManual && override) || timestamp > existing.timestamp;
    if (!allowUpdate) {
      return {
        ok: false, code: 'STALE_EXIT', httpStatus: 200,
        message: 'Já existe uma saída mais recente registrada hoje.',
        existingEventId: existing.id, student: studentInfo,
      };
    }
    const updated = await prisma.attendanceEvent.update({
      where: { id: existing.id },
      data: {
        timestamp,
        notes, // recomputed for the NEW time — an early-exit note can't outlive a later exit
        dayKey: day.dateStr,
        notified: false,
        ...(isManual ? { isManual: true } : {}),
        ...(confidence != null ? { confidence } : {}),
        ...(photoUrl ? { photoUrl } : {}),
      },
    });
    if (isManual) {
      await audit('MANUAL_CHECKIN_OVERRIDE', updated.id);
    } else {
      await notify(updated.id, timestamp);
    }
    return {
      ok: true, created: false, updated: true, status,
      event: { id: updated.id, eventType: updated.eventType, timestamp: updated.timestamp, notes: updated.notes },
      student: studentInfo,
    };
  }

  // ── Create (dayKey unique index closes the check-then-create race) ─────
  let event;
  try {
    event = await prisma.attendanceEvent.create({
      data: {
        studentId,
        deviceId: deviceId || null,
        eventType,
        timestamp,
        dayKey: day.dateStr,
        photoUrl,
        confidence: confidence ?? null,
        isManual,
        notes,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Lost the race: another camera created this (studentId, eventType, day) first.
      const winner = await prisma.attendanceEvent.findFirst({
        where: { studentId, eventType, dayKey: day.dateStr },
        select: { id: true },
      });
      return {
        ok: false,
        code: eventType === 'ENTRY' ? 'DUPLICATE_ENTRY' : 'STALE_EXIT',
        httpStatus: 200,
        message: 'Evento já registrado por outro dispositivo.',
        existingEventId: winner?.id, student: studentInfo,
      };
    }
    throw err;
  }

  await audit('MANUAL_CHECKIN', event.id);
  await notify(event.id, timestamp);

  return {
    ok: true, created: true, updated: false, status,
    event: { id: event.id, eventType: event.eventType, timestamp: event.timestamp, notes: event.notes },
    student: studentInfo,
  };
}
