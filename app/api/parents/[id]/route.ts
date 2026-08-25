import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

const parentInclude = {
  user: { select: { id: true, email: true, name: true, image: true, createdAt: true } },
  students: {
    include: { student: { select: { id: true, name: true, class: { select: { name: true } } } } },
  },
} satisfies Prisma.ParentInclude;

/**
 * A parent is in scope for this school when they are linked to at least one
 * of its students. Parents with no link yet are also editable, so a freshly
 * created record can be corrected before being linked.
 */
async function findParentInScope(parentId: string, schoolId: string) {
  return prisma.parent.findFirst({
    where: {
      id: parentId,
      OR: [{ students: { some: { student: { schoolId } } } }, { students: { none: {} } }],
    },
    include: parentInclude,
  });
}

/** PATCH /api/parents/[id] — update name, phone, cpf or password. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const parent = await findParentInScope(params.id, auth.schoolId);
  if (!parent) return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const data: Prisma.ParentUpdateInput = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    data.name = name;
    data.user = { update: { name } };
  }
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;

  if (body.cpf !== undefined) {
    const cpf = body.cpf ? String(body.cpf).trim() : null;
    if (cpf) {
      const taken = await prisma.parent.findFirst({
        where: { cpf, id: { not: parent.id } },
        select: { id: true },
      });
      if (taken) return NextResponse.json({ error: 'Já existe um responsável com este CPF.' }, { status: 409 });
    }
    data.cpf = cpf;
  }

  if (body.password) {
    const password = String(body.password);
    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 8 caracteres.' }, { status: 400 });
    }
    const userUpdate = { passwordHash: await bcrypt.hash(password, 10) };
    data.user = data.user
      ? { update: { ...(data.user as any).update, ...userUpdate } }
      : { update: userUpdate };
  }

  const updated = await prisma.parent.update({
    where: { id: parent.id },
    data,
    include: parentInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id ?? null,
      action: 'PARENT_UPDATED',
      entityType: 'Parent',
      entityId: parent.id,
      metadata: JSON.stringify({ fields: Object.keys(body), passwordChanged: !!body.password }),
    },
  }).catch(() => {});

  return NextResponse.json(updated);
}

/**
 * DELETE /api/parents/[id] — remove the parent and their user account.
 * Refused while the parent still has linked students, so a guardian is never
 * detached from a child by accident.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const parent = await findParentInScope(params.id, auth.schoolId);
  if (!parent) return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 });

  if (parent.students.length > 0) {
    return NextResponse.json(
      { error: `Desvincule os ${parent.students.length} aluno(s) antes de excluir.` },
      { status: 409 }
    );
  }

  // Parent has onDelete: Cascade on userId, so removing the user removes both.
  await prisma.user.delete({ where: { id: parent.userId } });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id ?? null,
      action: 'PARENT_DELETED',
      entityType: 'Parent',
      entityId: parent.id,
      metadata: JSON.stringify({ name: parent.name, email: parent.user.email }),
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
