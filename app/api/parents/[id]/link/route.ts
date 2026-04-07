import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/parents/[id]/link — admin links a student to a parent
 * Body: { studentId: string, relationship?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { studentId, relationship } = await req.json();

  if (!studentId) {
    return NextResponse.json({ error: 'studentId obrigatório.' }, { status: 400 });
  }

  // Verify parent exists
  const parent = await prisma.parent.findFirst({
    where: { id: params.id, user: { schoolId } },
  });
  if (!parent) {
    return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 });
  }

  // Verify student exists in same school
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, isActive: true },
    select: { id: true, name: true, class: { select: { name: true } } },
  });
  if (!student) {
    return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });
  }

  // Check if already linked
  const existing = await prisma.studentParent.findUnique({
    where: { studentId_parentId: { studentId, parentId: params.id } },
  });
  if (existing) {
    return NextResponse.json({ error: `${student.name} já está vinculado(a).` }, { status: 409 });
  }

  const isFirst = await prisma.studentParent.count({ where: { studentId } }) === 0;

  await prisma.studentParent.create({
    data: {
      studentId,
      parentId: params.id,
      relationship: relationship || 'Responsável',
      isPrimary: isFirst,
    },
  });

  return NextResponse.json({
    success: true,
    student: { name: student.name, className: student.class?.name },
  });
}

/**
 * DELETE /api/parents/[id]/link — admin unlinks a student from a parent
 * Body: { studentId: string }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { studentId } = await req.json();
  if (!studentId) {
    return NextResponse.json({ error: 'studentId obrigatório.' }, { status: 400 });
  }

  await prisma.studentParent.delete({
    where: { studentId_parentId: { studentId, parentId: params.id } },
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
