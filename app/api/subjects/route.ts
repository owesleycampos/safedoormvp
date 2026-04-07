import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;

  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    include: {
      _count: { select: { schedules: true, events: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ subjects });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório.' }, { status: 400 });
  }

  const existing = await prisma.subject.findUnique({
    where: { name_schoolId: { name: name.trim(), schoolId } },
  });

  if (existing) {
    return NextResponse.json({ error: 'Matéria já existe.' }, { status: 409 });
  }

  const subject = await prisma.subject.create({
    data: { name: name.trim(), schoolId },
  });

  return NextResponse.json(subject, { status: 201 });
}
