import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import { registerAttendanceEvent } from '@/lib/attendance-service';
import { DEFAULT_TIMEZONE, hasExplicitTimezone, zonedWallClockUtc } from '@/lib/timezone';

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
export async function POST(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const { studentId, eventType, notes, override, timestamp } = body;

  if (!studentId || !eventType || !['ENTRY', 'EXIT'].includes(eventType)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  // A tela manda "YYYY-MM-DDTHH:mm:00" SEM fuso (é a hora de parede da escola).
  // `new Date()` interpretaria isso como hora do SERVIDOR (UTC na Vercel), o que
  // gravava tudo 3h adiantado. Sem fuso explícito → converte no fuso da ESCOLA.
  let eventTime: Date;
  if (!timestamp) {
    eventTime = new Date();
  } else if (hasExplicitTimezone(String(timestamp))) {
    eventTime = new Date(String(timestamp));
  } else {
    eventTime = zonedWallClockUtc(String(timestamp), auth.timezone || DEFAULT_TIMEZONE);
  }
  if (isNaN(eventTime.getTime())) {
    return NextResponse.json({ error: 'Timestamp inválido.' }, { status: 400 });
  }
  // Relógio adiantado (tablet/cliente) não pode gravar no futuro: um evento com
  // data futura fica preso na janela de cooldown e some da chamada por dias.
  const nowMs = Date.now();
  if (eventTime.getTime() > nowMs + 5 * 60_000) {
    return NextResponse.json(
      { error: 'Horário no futuro. Confira o relógio do aparelho.' },
      { status: 400 }
    );
  }

  const result = await registerAttendanceEvent({
    studentId,
    eventType,
    source: 'MANUAL',
    schoolId: auth.schoolId,
    timestamp: eventTime,
    explicitNotes: notes ?? null,
    override: !!override,
    actorUserId: (auth.session.user as any)?.id ?? null,
    actorName: (auth.session.user as any)?.name || 'admin',
  });

  if (!result.ok) {
    if (result.code === 'STUDENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });
    }
    if (result.code === 'SCHOOL_INACTIVE') {
      return NextResponse.json({ error: result.message }, { status: 403 });
    }
    return NextResponse.json({
      skipped: true,
      reason: result.message,
      existingEventId: result.existingEventId,
    });
  }

  return NextResponse.json(
    { success: true, event: result.event },
    { status: result.created ? 201 : 200 }
  );
}

export async function DELETE(req: NextRequest) {
  // Mesmo guard do POST: escola suspensa/cancelada não pode apagar histórico.
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;
  const { session, schoolId } = auth;
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
