import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notifyParentsOfStudent, formatAttendanceNotification } from '@/lib/notifications';
import { determineAttendanceStatus } from '@/lib/attendance-rules';

/**
 * POST /api/events/manual
 *
 * Body: {
 *   studentId: string
 *   eventType: 'ENTRY' | 'EXIT'
 *   notes?: string          // 'ATRASO' | 'SAIDA_ANTECIPADA' | free text
 *   override?: boolean      // force replace existing entry for today
 *   timestamp?: string      // ISO — defaults to now
 * }
 *
 * DELETE /api/events/manual
 * Body: { eventId: string }  — remove a specific event
 */

const validEventTypes = ['ENTRY', 'EXIT'];
const validNotes = ['ATRASO', 'SAIDA_ANTECIPADA'];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const adminName = (session.user as any)?.name || 'admin';
  const body = await req.json();
  const { studentId, eventType, notes, override, timestamp } = body;

  if (!studentId || !eventType || !validEventTypes.includes(eventType)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { school: { select: { name: true } } },
  });
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  const eventTime = timestamp ? new Date(timestamp) : new Date();
  const dayStart = new Date(eventTime); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(dayStart);  dayEnd.setDate(dayEnd.getDate() + 1);

  // Auto-determine status from school schedule if no explicit notes
  const autoStatus = await determineAttendanceStatus(studentId, eventType as 'ENTRY' | 'EXIT', eventTime);

  // Build notes string
  let notesStr: string;
  if (notes && validNotes.includes(notes)) {
    const labelMap: Record<string, string> = {
      ATRASO: 'ATRASO',
      SAIDA_ANTECIPADA: 'SAIDA_ANTECIPADA',
    };
    notesStr = labelMap[notes];
  } else if (!notes && autoStatus === 'ATRASO') {
    notesStr = 'ATRASO';
  } else if (!notes && autoStatus === 'SAIDA_ANTECIPADA') {
    notesStr = 'SAIDA_ANTECIPADA';
  } else {
    notesStr = notes || `Registro manual por ${adminName}`;
  }

  // ── Handle ENTRY ──────────────────────────────────────────────
  if (eventType === 'ENTRY') {
    const existing = await prisma.attendanceEvent.findFirst({
      where: { studentId, eventType: 'ENTRY', timestamp: { gte: dayStart, lt: dayEnd } },
    });

    if (existing && !override) {
      return NextResponse.json({ skipped: true, reason: 'Entrada já registrada hoje.', existingEventId: existing.id });
    }

    if (existing && override) {
      // Update the existing entry (e.g., change to ATRASO)
      const updated = await prisma.attendanceEvent.update({
        where: { id: existing.id },
        data: { notes: notesStr, timestamp: eventTime, isManual: true },
      });
      return NextResponse.json({ success: true, event: updated }, { status: 200 });
    }
  }

  // ── Handle EXIT ───────────────────────────────────────────────
  if (eventType === 'EXIT') {
    const existing = await prisma.attendanceEvent.findFirst({
      where: { studentId, eventType: 'EXIT', timestamp: { gte: dayStart, lt: dayEnd } },
      orderBy: { timestamp: 'desc' },
    });

    if (existing && override) {
      const updated = await prisma.attendanceEvent.update({
        where: { id: existing.id },
        data: { notes: notesStr, timestamp: eventTime, isManual: true },
      });
      return NextResponse.json({ success: true, event: updated }, { status: 200 });
    }
  }

  // ── Create new event ──────────────────────────────────────────
  const event = await prisma.attendanceEvent.create({
    data: {
      studentId,
      eventType,
      isManual: true,
      notes: notesStr,
      timestamp: eventTime,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'MANUAL_CHECKIN',
      entityType: 'AttendanceEvent',
      entityId: event.id,
      metadata: JSON.stringify({ studentId, eventType, notes, studentName: student.name }),
    },
  });

  const notification = formatAttendanceNotification(student.name, eventType, eventTime, student.school.name);
  notifyParentsOfStudent(studentId, notification).catch(console.error);

  return NextResponse.json({ success: true, event }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { eventId } = await req.json();

  if (!eventId) return NextResponse.json({ error: 'eventId obrigatório.' }, { status: 400 });

  // Verify the event belongs to this school
  const event = await prisma.attendanceEvent.findFirst({
    where: { id: eventId, student: { schoolId } },
  });

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });

  await prisma.attendanceEvent.delete({ where: { id: eventId } });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'EVENT_DELETED',
      entityType: 'AttendanceEvent',
      entityId: eventId,
      metadata: JSON.stringify({ eventId, reason: 'Deleted via manual correction' }),
    },
  });

  return NextResponse.json({ success: true });
}
