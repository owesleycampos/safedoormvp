import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/onboarding/complete — marca o tutorial como concluído, para não
 * reaparecer no próximo login e para o dono ver no dossiê.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const schoolId = (session.user as any)?.schoolId;
  if (!schoolId) return NextResponse.json({ error: 'Escola não encontrada' }, { status: 400 });

  await prisma.school.update({
    where: { id: schoolId },
    data: { onboardingDoneAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
