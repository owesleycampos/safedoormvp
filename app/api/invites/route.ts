import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

/**
 * POST /api/invites — generate a class invite link
 * Body: { classId: string, regenerate?: boolean } — regenerate invalida o link anterior
 *
 * GET /api/invites — list invites for the school
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const userId = (session.user as any)?.id as string;
  const { classId, regenerate } = await req.json();

  if (!classId) {
    return NextResponse.json({ error: 'classId obrigatório.' }, { status: 400 });
  }

  // Verify class belongs to this school
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, name: true },
  });
  if (!cls) {
    return NextResponse.json({ error: 'Turma não encontrada.' }, { status: 404 });
  }

  // Reutiliza o convite ativo se ainda vale: reabrir o dialog para copiar
  // o link de novo NÃO pode invalidar o que 30 responsáveis já receberam
  // no WhatsApp. Só regenera com pedido explícito ({ regenerate: true }).
  let invite = regenerate
    ? null
    : await prisma.classInvite.findFirst({
        where: { classId, schoolId, isActive: true, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

  if (!invite) {
    await prisma.classInvite.updateMany({
      where: { classId, schoolId, isActive: true },
      data: { isActive: false },
    });

    const token = crypto.randomBytes(16).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    invite = await prisma.classInvite.create({
      data: {
        token,
        classId,
        schoolId,
        createdBy: userId,
        expiresAt,
      },
    });
  }

  const [school, missingBirthDate] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
    // The guardian proves the relationship by typing the child's birth date.
    // Students without one on file can't be claimed, so warn the admin now
    // instead of letting parents hit a wall after receiving the link.
    prisma.student.findMany({
      where: { classId, isActive: true, birthDate: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return NextResponse.json({
    success: true,
    invite: {
      id: invite.id,
      token: invite.token,
      className: cls.name,
      schoolName: school?.name,
      expiresAt: invite.expiresAt,
    },
    studentsMissingBirthDate: missingBirthDate.map((s) => s.name),
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;

  const invites = await prisma.classInvite.findMany({
    where: { schoolId, isActive: true },
    include: { class: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ invites });
}
