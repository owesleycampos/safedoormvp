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
  const { studentId, birthDate, parentName, phone, email, password, biometricConsent } = body;

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

  // The birth date is the ONLY proof that this person is related to this
  // child. Without it on file there is nothing to check, so the claim is
  // refused instead of silently letting anyone through.
  if (!student.birthDate) {
    return NextResponse.json(
      {
        error:
          'Este aluno ainda não tem data de nascimento cadastrada, então não é possível confirmar o vínculo por aqui. Peça à secretaria da escola para completar o cadastro.',
        missingBirthDate: true,
      },
      { status: 409 }
    );
  }

  // Comparação direta de strings YYYY-MM-DD: o re-parse antigo usava o fuso
  // do servidor e só coincidia com o valor gravado porque a Vercel roda em
  // UTC — em qualquer outro runtime toda data de nascimento "errava".
  const studentBD = student.birthDate.toISOString().slice(0, 10);
  const inputBD = String(birthDate).slice(0, 10);
  if (studentBD !== inputBD) {
    return NextResponse.json(
      { error: 'Data de nascimento incorreta. Confira com a escola e tente novamente.' },
      { status: 400 }
    );
  }

  // ── Find or create the account ────────────────────────────────────────
  // Three cases, and they must be told apart: an existing account has to
  // prove the password (it used to be accepted without any check, so anyone
  // knowing an e-mail and a birth date could attach children to someone
  // else's account); an account the school pre-created has no password yet
  // and the guardian sets it here; a brand-new account is created.
  const normalizedEmail = email ? String(email).toLowerCase().trim() : '';
  let user = normalizedEmail
    ? await prisma.user.findUnique({ where: { email: normalizedEmail } })
    : null;

  if (!normalizedEmail) {
    return NextResponse.json(
      { error: 'Informe seu e-mail.', needsAccount: true, accountExists: false },
      { status: 400 }
    );
  }

  if (user && user.passwordHash) {
    // Existing account with a password — authenticate.
    if (!password) {
      return NextResponse.json(
        {
          error: 'Já existe uma conta com este e-mail. Informe sua senha para continuar.',
          needsAccount: true,
          accountExists: true,
        },
        { status: 400 }
      );
    }
    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Senha incorreta.', needsAccount: true, accountExists: true },
        { status: 401 }
      );
    }
  } else if (user && !user.passwordHash) {
    // Account created by the school without a password — the guardian
    // defines it now, which is exactly what the invite is for.
    if (!password || String(password).length < 8) {
      return NextResponse.json(
        {
          error: 'Crie uma senha de ao menos 8 caracteres para acessar sua conta.',
          needsAccount: true,
          accountExists: true,
          needsPasswordSetup: true,
        },
        { status: 400 }
      );
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(String(password), 10), name: user.name || parentName },
    });
  } else {
    if (!password || String(password).length < 8) {
      return NextResponse.json(
        {
          error: 'Crie uma senha de ao menos 8 caracteres.',
          needsAccount: true,
          accountExists: false,
        },
        { status: 400 }
      );
    }
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: parentName,
        passwordHash: await bcrypt.hash(String(password), 10),
        role: 'PARENT',
        schoolId: invite.schoolId,
      },
    });
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

  // LGPD: o convite é o momento natural de colher o consentimento para o
  // uso das fotos no reconhecimento facial — quem autoriza é exatamente o
  // responsável que acabou de provar o vínculo pela data de nascimento.
  if (biometricConsent === true) {
    await prisma.student.update({
      where: { id: studentId },
      data: { biometricConsentAt: new Date(), biometricConsentName: parentName },
    }).catch(() => {});
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
