import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * POST /api/invites/[token]/claim — public endpoint
 * Body: { studentId, birthDate (YYYY-MM-DD), parentName, phone, email, password? }
 *
 * Links a parent to a student using the class invite.
 * Creates User + Parent if they don't exist.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const invite = await prisma.classInvite.findUnique({
    where: { token: params.token },
  });

  if (!invite || !invite.isActive || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 });
  }

  const body = await req.json();
  const { studentId, birthDate, parentName, phone, email, password } = body;

  if (!studentId || !birthDate || !parentName) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
  }

  // Verify student belongs to this class
  const student = await prisma.student.findFirst({
    where: { id: studentId, classId: invite.classId, isActive: true },
    select: {
      id: true,
      name: true,
      birthDate: true,
      class: { select: { name: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: 'Aluno não encontrado nesta turma.' }, { status: 404 });
  }

  // Validate birth date
  if (student.birthDate) {
    const studentBD = student.birthDate.toISOString().slice(0, 10);
    const inputBD = new Date(birthDate + 'T00:00:00').toISOString().slice(0, 10);
    if (studentBD !== inputBD) {
      return NextResponse.json({ error: 'Data de nascimento incorreta.' }, { status: 400 });
    }
  }

  // Find or create user
  let user;
  if (email) {
    user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  if (!user && email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: parentName,
        passwordHash,
        role: 'PARENT',
        schoolId: invite.schoolId,
      },
    });
  }

  if (!user) {
    return NextResponse.json({
      error: 'E-mail e senha são necessários para criar sua conta.',
      needsAccount: true,
    }, { status: 400 });
  }

  // Update user's school if needed
  if (!user.schoolId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { schoolId: invite.schoolId },
    });
  }

  // Find or create parent
  let parent = await prisma.parent.findUnique({ where: { userId: user.id } });
  if (!parent) {
    parent = await prisma.parent.create({
      data: {
        userId: user.id,
        name: parentName,
        phone: phone || null,
      },
    });
  }

  // Check if already linked
  const existing = await prisma.studentParent.findUnique({
    where: { studentId_parentId: { studentId, parentId: parent.id } },
  });

  if (existing) {
    return NextResponse.json({
      success: true,
      alreadyLinked: true,
      message: `${student.name} já está vinculado(a) à sua conta.`,
      student: { name: student.name, className: student.class?.name },
    });
  }

  // Create link
  const isFirst = await prisma.studentParent.count({ where: { studentId } }) === 0;

  await prisma.studentParent.create({
    data: {
      studentId,
      parentId: parent.id,
      relationship: 'Responsável',
      isPrimary: isFirst,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'PARENT_INVITE_LINKED',
      entityType: 'StudentParent',
      entityId: studentId,
      metadata: JSON.stringify({
        parentId: parent.id,
        studentName: student.name,
        inviteToken: params.token,
      }),
    },
  });

  // Check if there are other students in same class not yet linked to this parent
  const otherStudents = await prisma.student.findMany({
    where: {
      classId: invite.classId,
      isActive: true,
      id: { not: studentId },
      NOT: { parents: { some: { parentId: parent.id } } },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    success: true,
    message: `${student.name} vinculado(a) com sucesso!`,
    student: { name: student.name, className: student.class?.name },
    hasMoreStudents: otherStudents.length > 0,
    userId: user.id,
  });
}
