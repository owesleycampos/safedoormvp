import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const links = await prisma.studentParent.findMany({
    where: { studentId: params.id },
    include: {
      parent: {
        include: {
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ parents: links });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { parentId, relationship, isPrimary } = await req.json();
  if (!parentId) return NextResponse.json({ error: 'parentId é obrigatório.' }, { status: 400 });

  // Check already linked
  const existing = await prisma.studentParent.findUnique({
    where: { studentId_parentId: { studentId: params.id, parentId } },
  });
  if (existing) return NextResponse.json({ error: 'Responsável já vinculado.' }, { status: 409 });

  // If isPrimary, unset other primaries
  if (isPrimary) {
    await prisma.studentParent.updateMany({
      where: { studentId: params.id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const link = await prisma.studentParent.create({
    data: {
      studentId: params.id,
      parentId,
      relationship: relationship || 'Responsável',
      isPrimary: isPrimary || false,
    },
    include: {
      parent: {
        include: { user: { select: { email: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ link }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { parentId } = await req.json();
  if (!parentId) return NextResponse.json({ error: 'parentId é obrigatório.' }, { status: 400 });

  await prisma.studentParent.delete({
    where: { studentId_parentId: { studentId: params.id, parentId } },
  });

  return NextResponse.json({ ok: true });
}
