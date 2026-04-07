import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/invites/[token] — public endpoint
 * Returns class info + alphabetical student list for the invite page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const invite = await prisma.classInvite.findUnique({
    where: { token: params.token },
    include: {
      class: { select: { id: true, name: true, grade: true } },
      school: { select: { name: true, logoUrl: true } },
    },
  });

  if (!invite || !invite.isActive || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Link inválido ou expirado.' },
      { status: 404 }
    );
  }

  const students = await prisma.student.findMany({
    where: { classId: invite.classId, isActive: true },
    select: {
      id: true,
      name: true,
      photoUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    school: invite.school,
    class: invite.class,
    students,
    expiresAt: invite.expiresAt,
  });
}
