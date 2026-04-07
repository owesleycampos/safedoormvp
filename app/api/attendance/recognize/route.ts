import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notifyParentsOfStudent, formatAttendanceNotification } from '@/lib/notifications';
import { determineAttendanceStatus } from '@/lib/attendance-rules';

// Database-backed cooldown: prevents duplicate registrations across
// multiple cameras, server instances, and restarts.
const COOLDOWN_SECONDS = 60; // minimum seconds between registrations for same student+type

/**
 * POST /api/attendance/recognize
 *
 * Called by the browser camera page when a face is matched.
 * Body: { studentId: string, type: 'ENTRY' | 'EXIT', confidence: number }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;

  let studentId: string;
  let type: string;
  let confidence: number;

  try {
    const body = await req.json();
    studentId = body.studentId;
    type = body.type;
    confidence = body.confidence ?? 1;

    if (!studentId || !['ENTRY', 'EXIT'].includes(type)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  // ── Database-backed cooldown (works across multiple cameras/instances) ──
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_SECONDS * 1000);
  const recentEvent = await prisma.attendanceEvent.findFirst({
    where: {
      studentId,
      eventType: type,
      timestamp: { gte: cooldownCutoff },
    },
    orderBy: { timestamp: 'desc' },
  });
  if (recentEvent) {
    return NextResponse.json({ skipped: true, reason: 'cooldown' }, { status: 200 });
  }

  // ── Find student ──────────────────────────────────────────────────
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, isActive: true },
    include: {
      school: { select: { name: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
  }

  const eventType = type as 'ENTRY' | 'EXIT';
  const timestamp = new Date();

  const dayStart = new Date(timestamp);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // ── Prevent duplicate ENTRY per day ──────────────────────────────
  if (eventType === 'ENTRY') {
    const existingEntry = await prisma.attendanceEvent.findFirst({
      where: {
        studentId,
        eventType: 'ENTRY',
        timestamp: { gte: dayStart, lt: dayEnd },
      },
    });

    if (existingEntry) {
      return NextResponse.json({
        skipped: true,
        reason: 'Entrada já registrada hoje',
        existingEventId: existingEntry.id,
        student: { name: student.name, photoUrl: student.photoUrl },
      });
    }
  }

  // ── Prevent duplicate EXIT per day (update latest exit time) ────
  if (eventType === 'EXIT') {
    const existingExit = await prisma.attendanceEvent.findFirst({
      where: {
        studentId,
        eventType: 'EXIT',
        timestamp: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (existingExit) {
      const event = await prisma.attendanceEvent.update({
        where: { id: existingExit.id },
        data: { timestamp, confidence, notified: false },
      });

      const notification = formatAttendanceNotification(
        student.name, 'EXIT', timestamp, student.school.name
      );
      notifyParentsOfStudent(studentId, notification).catch(console.error);

      await prisma.attendanceEvent.update({
        where: { id: event.id },
        data: { notified: true },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        student: { name: student.name, photoUrl: student.photoUrl },
        event: { id: event.id, eventType: event.eventType, timestamp: event.timestamp },
      }, { status: 200 });
    }
  }

  // ── Determine attendance status (late/early) from school schedule ──
  const status = await determineAttendanceStatus(studentId, eventType, timestamp);
  const autoNotes = status === 'ATRASO' ? 'ATRASO' : status === 'SAIDA_ANTECIPADA' ? 'SAIDA_ANTECIPADA' : undefined;

  // ── Create new event ────────────────────────────────────────────
  const event = await prisma.attendanceEvent.create({
    data: {
      studentId,
      eventType,
      timestamp,
      confidence,
      isManual: false,
      ...(autoNotes && { notes: autoNotes }),
    },
  });

  // ── Push notification (fire-and-forget) ──────────────────────────
  const notification = formatAttendanceNotification(
    student.name,
    eventType,
    timestamp,
    student.school.name
  );
  notifyParentsOfStudent(studentId, notification).catch(console.error);

  // Mark as notified
  await prisma.attendanceEvent.update({
    where: { id: event.id },
    data: { notified: true },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    student: { name: student.name, photoUrl: student.photoUrl },
    event: {
      id: event.id,
      eventType: event.eventType,
      timestamp: event.timestamp,
    },
  }, { status: 201 });
}
