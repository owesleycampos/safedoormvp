import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const schoolId = (session.user as any)?.schoolId;

  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: { _count: { select: { students: { where: { isActive: true } } } } },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({ classes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;
  const { name, grade } = await req.json();

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

  const cls = await prisma.class.create({
    data: { name, grade: grade || name, schoolId },
    include: { _count: { select: { students: true } } },
  });

  return NextResponse.json({ class: cls }, { status: 201 });
}
