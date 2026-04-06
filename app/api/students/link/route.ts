import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/students/link
 *
 * Parent self-service: link to a student using their accessCode.
 * Body: { accessCode: string }
 *
 * Called from the PWA by a logged-in parent.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const userId = (session.user as any)?.id as string;
  const role = (session.user as any)?.role;

  if (role !== 'PARENT') {
    return NextResponse.json({ error: 'Apenas responsáveis podem vincular alunos.' }, { status: 403 });
  }

  const { accessCode } = await req.json();
  if (!accessCode || typeof accessCode !== 'string') {
    return NextResponse.json({ error: 'Código de acesso inválido.' }, { status: 400 });
  }

  const code = accessCode.trim().toUpperCase();

  // Find student by access code
  const student = await prisma.student.findFirst({
    where: { accessCode: code, isActive: true },
    select: {
      id: true,
      name: true,
      schoolId: true,
      class: { select: { name: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: 'Código não encontrado. Verifique com a escola.' }, { status: 404 });
  }

  // Find parent record
  const parent = await prisma.parent.findUnique({ where: { userId } });
  if (!parent) {
    return NextResponse.json({ error: 'Perfil de responsável não encontrado.' }, { status: 404 });
  }

  // Check if already linked
  const existing = await prisma.studentParent.findUnique({
    where: { studentId_parentId: { studentId: student.id, parentId: parent.id } },
  });
  if (existing) {
    return NextResponse.json({
      error: `${student.name} já está vinculado(a) à sua conta.`,
    }, { status: 409 });
  }

  // Create link
  const isFirst = await prisma.studentParent.count({ where: { studentId: student.id } }) === 0;

  await prisma.studentParent.create({
    data: {
      studentId: student.id,
      parentId: parent.id,
      relationship: 'Responsável',
      isPrimary: isFirst,
    },
  });

  // Also set parent's school to match the student's school
  await prisma.user.update({
    where: { id: userId },
    data: { schoolId: student.schoolId },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PARENT_SELF_LINKED',
      entityType: 'StudentParent',
      entityId: student.id,
      metadata: JSON.stringify({
        parentId: parent.id,
        studentName: student.name,
        accessCode: code,
      }),
    },
  });

  return NextResponse.json({
    success: true,
    student: {
      name: student.name,
      className: student.class?.name,
    },
    message: `${student.name} vinculado(a) com sucesso!`,
  });
}
