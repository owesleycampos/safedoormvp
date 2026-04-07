import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { name, color } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório.' }, { status: 400 });
  }

  const subject = await prisma.subject.findFirst({
    where: { id: params.id, schoolId },
  });

  if (!subject) {
    return NextResponse.json({ error: 'Matéria não encontrada.' }, { status: 404 });
  }

  const updated = await prisma.subject.update({
    where: { id: params.id },
    data: { name: name.trim(), ...(color !== undefined ? { color: color || null } : {}) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;

  const subject = await prisma.subject.findFirst({
    where: { id: params.id, schoolId },
    include: { _count: { select: { schedules: true, events: true } } },
  });

  if (!subject) {
    return NextResponse.json({ error: 'Matéria não encontrada.' }, { status: 404 });
  }

  if (subject._count.events > 0) {
    return NextResponse.json({
      error: 'Não é possível excluir uma matéria com eventos de frequência vinculados.',
    }, { status: 400 });
  }

  // Delete associated schedules first
  await prisma.classSchedule.deleteMany({ where: { subjectId: params.id } });
  await prisma.subject.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
