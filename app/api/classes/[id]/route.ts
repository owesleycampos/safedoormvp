import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const schoolId = (session.user as any)?.schoolId;

  const cls = await prisma.class.findFirst({
    where: { id: params.id, schoolId },
    include: {
      students: {
        where: { isActive: true },
        include: {
          photos: { where: { isProfile: true }, take: 1 },
          parents: {
            include: {
              parent: { include: { user: { select: { email: true } } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!cls) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });

  return NextResponse.json({ class: cls });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;
  const body = await req.json();
  const { name, grade, shift } = body;

  const existing = await prisma.class.findFirst({ where: { id: params.id, schoolId } });
  if (!existing) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });

  const updated = await prisma.class.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(grade !== undefined && { grade }),
      ...(shift !== undefined && { shift }),
    },
    include: { _count: { select: { students: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;

  const cls = await prisma.class.findFirst({
    where: { id: params.id, schoolId },
    include: { _count: { select: { students: true } } },
  });
  if (!cls) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  if (cls._count.students > 0) {
    return NextResponse.json({ error: 'Turma possui alunos. Mova-os antes de excluir.' }, { status: 400 });
  }

  await prisma.class.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
