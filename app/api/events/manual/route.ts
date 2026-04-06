import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notifyParentsOfStudent, formatAttendanceNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;
  const { studentId, eventType, notes } = await req.json();

  if (!studentId || !eventType || !['ENTRY', 'EXIT'].includes(eventType)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { school: { select: { name: true } } },
  });
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  // ── Prevent duplicate ENTRY per day (same as camera recognition) ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (eventType === 'ENTRY') {
    const existingEntry = await prisma.attendanceEvent.findFirst({
      where: { studentId, eventType: 'ENTRY', timestamp: { gte: today, lt: tomorrow } },
    });
    if (existingEntry) {
      return NextResponse.json({
        skipped: true,
        reason: 'Entrada já registrada hoje para este aluno.',
      });
    }
  }

  const event = await prisma.attendanceEvent.create({
    data: {
      studentId,
      eventType,
      isManual: true,
      notes: notes || `Registro manual por ${(session.user as any)?.name || 'admin'}`,
      timestamp: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'MANUAL_CHECKIN',
      entityType: 'AttendanceEvent',
      entityId: event.id,
      metadata: JSON.stringify({ studentId, eventType, studentName: student.name }),
    },
  });

  // Notify parents
  const notification = formatAttendanceNotification(
    student.name,
    eventType,
    new Date(),
    student.school.name
  );
  notifyParentsOfStudent(studentId, notification).catch(console.error);

  return NextResponse.json({ success: true, event }, { status: 201 });
}
