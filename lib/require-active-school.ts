import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Validates that the current session belongs to an ADMIN of an operational
 * school: not SUSPENDED, not CANCELLED, and not a TRIAL past trialEndsAt.
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
    select: {
      status: true,
      subscription: { select: { trialEndsAt: true } },
      // O fuso vem junto na mesma consulta: quase toda rota que valida a
      // escola também precisa dele, e cada chamada a getSchoolTimezone era
      // uma ida extra ao banco por request.
      settings: { select: { timezone: true } },
    },
  });

  if (!school || school.status === 'SUSPENDED' || school.status === 'CANCELLED') {
    return { error: NextResponse.json({ error: 'Escola suspensa ou cancelada' }, { status: 403 }) };
  }

  if (
    school.status === 'TRIAL' &&
    school.subscription?.trialEndsAt != null &&
    school.subscription.trialEndsAt < new Date()
  ) {
    return { error: NextResponse.json({ error: 'Período de teste expirado' }, { status: 403 }) };
  }

  return { session, schoolId, timezone: school.settings?.timezone || 'America/Sao_Paulo' };
}
