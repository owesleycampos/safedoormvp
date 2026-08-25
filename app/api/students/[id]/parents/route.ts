/**
 * Canonical endpoint for the student ↔ guardian relationship.
 *
 * The link is a property of the STUDENT: the school asks "who answers for
 * this child?", not "which children does this person have". Every admin path
 * goes through here; /api/parents/[id]/link is the deprecated mirror of it.
 *
 * POST accepts either an existing `parentId` or the fields of a new guardian
 * (`name` + `email`), so the UI can offer one "find or create" field instead
 * of a separate registration step.
 */
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

const linkInclude = {
  parent: {
    include: { user: { select: { id: true, email: true, name: true, image: true } } },
  },
} satisfies Prisma.StudentParentInclude;

/** The student must belong to the caller's school. */
async function studentInScope(studentId: string, schoolId: string) {
  return prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, name: true },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const student = await studentInScope(params.id, auth.schoolId);
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  const links = await prisma.studentParent.findMany({
    where: { studentId: params.id },
    include: linkInclude,
    orderBy: [{ isPrimary: 'desc' }],
  });

  return NextResponse.json({ parents: links });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const student = await studentInScope(params.id, auth.schoolId);
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const relationship = typeof body.relationship === 'string' && body.relationship.trim()
    ? body.relationship.trim()
    : 'Responsável';
  const isPrimary = !!body.isPrimary;

  let parentId: string | null = typeof body.parentId === 'string' ? body.parentId : null;
  let createdParent = false;

  // ── Create the guardian inline when no parentId was given ──────────────
  if (!parentId) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = body.phone ? String(body.phone).trim() : null;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Informe um responsável existente ou o nome e e-mail de um novo.' },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    }

    // An existing account with this e-mail is reused instead of rejected —
    // that is the whole point of "find or create".
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, parent: { select: { id: true } } },
    });

    if (existingUser?.parent) {
      parentId = existingUser.parent.id;
    } else if (existingUser) {
      return NextResponse.json(
        { error: 'Este e-mail já pertence a outro tipo de usuário.' },
        { status: 409 }
      );
    } else {
      const password = typeof body.password === 'string' ? body.password : '';
      if (password && password.length < 8) {
        return NextResponse.json({ error: 'A senha deve ter ao menos 8 caracteres.' }, { status: 400 });
      }
      const parent = await prisma.parent.create({
        data: {
          name,
          phone,
          user: {
            create: {
              email,
              name,
              role: 'PARENT',
              ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
            },
          },
        },
        select: { id: true },
      });
      parentId = parent.id;
      createdParent = true;
    }
  } else {
    // Linking an existing guardian: they must already belong to this school
    // or be unattached, so one school can't reach into another's records.
    const inScope = await prisma.parent.findFirst({
      where: {
        id: parentId,
        OR: [{ students: { some: { student: { schoolId: auth.schoolId } } } }, { students: { none: {} } }],
      },
      select: { id: true },
    });
    if (!inScope) {
      return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 });
    }
  }

  const already = await prisma.studentParent.findUnique({
    where: { studentId_parentId: { studentId: params.id, parentId: parentId! } },
  });
  if (already) {
    return NextResponse.json({ error: 'Responsável já vinculado a este aluno.' }, { status: 409 });
  }

  if (isPrimary) {
    await prisma.studentParent.updateMany({
      where: { studentId: params.id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const link = await prisma.studentParent.create({
    data: { studentId: params.id, parentId: parentId!, relationship, isPrimary },
    include: linkInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id ?? null,
      action: createdParent ? 'PARENT_CREATED_AND_LINKED' : 'PARENT_LINKED',
      entityType: 'Student',
      entityId: params.id,
      metadata: JSON.stringify({
        studentName: student.name,
        parentId,
        parentName: link.parent.name,
        relationship,
      }),
    },
  }).catch(() => {});

  return NextResponse.json({ link, createdParent }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const student = await studentInScope(params.id, auth.schoolId);
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const { parentId } = body;
  if (!parentId) return NextResponse.json({ error: 'parentId é obrigatório.' }, { status: 400 });

  const link = await prisma.studentParent.findUnique({
    where: { studentId_parentId: { studentId: params.id, parentId } },
    include: linkInclude,
  });
  if (!link) return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 });

  await prisma.studentParent.delete({
    where: { studentId_parentId: { studentId: params.id, parentId } },
  });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id ?? null,
      action: 'PARENT_UNLINKED',
      entityType: 'Student',
      entityId: params.id,
      metadata: JSON.stringify({ studentName: student.name, parentName: link.parent.name }),
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
