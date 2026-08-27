import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const schoolId = (session.user as any)?.schoolId;
  if (!schoolId) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: { _count: { select: { students: { where: { isActive: true } } } } },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({ classes });
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;
  const { schoolId } = auth;
  const { name, grade, shift } = await req.json();

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

  const cls = await prisma.class.create({
    data: { name, grade: grade || name, shift: shift || null, schoolId },
    include: { _count: { select: { students: true } } },
  });

  return NextResponse.json(cls, { status: 201 });
}
