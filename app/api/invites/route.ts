import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

/**
 * POST /api/invites — generate a class invite link
 * Body: { classId: string }
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
  const { classId } = await req.json();

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

  // Deactivate previous invites for this class
  await prisma.classInvite.updateMany({
    where: { classId, schoolId, isActive: true },
    data: { isActive: false },
  });

  // Generate new invite
  const token = crypto.randomBytes(16).toString('base64url');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const invite = await prisma.classInvite.create({
    data: {
      token,
      classId,
      schoolId,
      createdBy: userId,
      expiresAt,
    },
  });

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });

  return NextResponse.json({
    success: true,
    invite: {
      id: invite.id,
      token: invite.token,
      className: cls.name,
      schoolName: school?.name,
      expiresAt: invite.expiresAt,
    },
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
