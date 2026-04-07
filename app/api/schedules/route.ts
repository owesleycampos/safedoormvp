import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/schedules?classId=...
 * Returns the timetable for a specific class.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const classId = req.nextUrl.searchParams.get('classId');

  if (!classId) {
    return NextResponse.json({ error: 'classId obrigatório.' }, { status: 400 });
  }

  const schedules = await prisma.classSchedule.findMany({
    where: {
      classId,
      class: { schoolId },
    },
    include: {
      subject: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
  });

  return NextResponse.json({ schedules });
}

/**
 * POST /api/schedules
 * Body: { classId, subjectId, dayOfWeek, period, startTime, endTime, teacherName? }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const body = await req.json();
  const { classId, subjectId, dayOfWeek, period, startTime, endTime, teacherName } = body;

  if (!classId || !subjectId || dayOfWeek == null || !period || !startTime || !endTime) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
  }

  // Verify class belongs to school
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
  if (!cls) {
    return NextResponse.json({ error: 'Turma não encontrada.' }, { status: 404 });
  }

  // Verify subject belongs to school
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
  if (!subject) {
    return NextResponse.json({ error: 'Matéria não encontrada.' }, { status: 404 });
  }

  // Upsert by classId + dayOfWeek + period
  const schedule = await prisma.classSchedule.upsert({
    where: {
      classId_dayOfWeek_period: { classId, dayOfWeek: Number(dayOfWeek), period: Number(period) },
    },
    update: {
      subjectId,
      startTime,
      endTime,
      teacherName: teacherName || null,
    },
    create: {
      classId,
      subjectId,
      dayOfWeek: Number(dayOfWeek),
      period: Number(period),
      startTime,
      endTime,
      teacherName: teacherName || null,
    },
    include: { subject: { select: { id: true, name: true } } },
  });

  return NextResponse.json(schedule, { status: 201 });
}

/**
 * PUT /api/schedules (copy timetable)
 * Body: { fromClassId, toClassId }
 * Copies all schedule entries from one class to another.
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { fromClassId, toClassId } = await req.json();

  if (!fromClassId || !toClassId) {
    return NextResponse.json({ error: 'fromClassId e toClassId obrigatórios.' }, { status: 400 });
  }

  // Verify both classes belong to school
  const [fromClass, toClass] = await Promise.all([
    prisma.class.findFirst({ where: { id: fromClassId, schoolId } }),
    prisma.class.findFirst({ where: { id: toClassId, schoolId } }),
  ]);
  if (!fromClass || !toClass) {
    return NextResponse.json({ error: 'Turma não encontrada.' }, { status: 404 });
  }

  // Get source schedules
  const source = await prisma.classSchedule.findMany({
    where: { classId: fromClassId },
  });

  if (source.length === 0) {
    return NextResponse.json({ error: 'Turma de origem não tem grade horária.' }, { status: 400 });
  }

  // Clear target and copy
  await prisma.classSchedule.deleteMany({ where: { classId: toClassId } });

  let copied = 0;
  for (const s of source) {
    await prisma.classSchedule.create({
      data: {
        classId: toClassId,
        subjectId: s.subjectId,
        dayOfWeek: s.dayOfWeek,
        period: s.period,
        startTime: s.startTime,
        endTime: s.endTime,
        teacherName: s.teacherName,
      },
    });
    copied++;
  }

  return NextResponse.json({ success: true, copied });
}

/**
 * DELETE /api/schedules?id=...
 * Deletes a single schedule entry.
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 });
  }

  const schedule = await prisma.classSchedule.findFirst({
    where: { id, class: { schoolId } },
  });

  if (!schedule) {
    return NextResponse.json({ error: 'Horário não encontrado.' }, { status: 404 });
  }

  await prisma.classSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
