import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Validates that the current session belongs to an ADMIN of an ACTIVE school.
 * Returns { session, schoolId } on success, or a NextResponse error.
 */
export async function requireActiveSchool() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };
  }

  const schoolId = (session.user as any)?.schoolId as string;
  if (!schoolId) {
    return { error: NextResponse.json({ error: 'Escola não vinculada' }, { status: 403 }) };
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { status: true },
  });

  if (!school || school.status === 'SUSPENDED' || school.status === 'CANCELLED') {
    return { error: NextResponse.json({ error: 'Escola suspensa ou cancelada' }, { status: 403 }) };
  }

  return { session, schoolId };
}
