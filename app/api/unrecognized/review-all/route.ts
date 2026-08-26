import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * PATCH /api/unrecognized/review-all — marca todos os pendentes da escola
 * como revisados de uma vez. Par da rota individual; também não existia.
 */
export async function PATCH() {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const result = await prisma.unrecognizedFaceLog.updateMany({
    where: { schoolId: auth.schoolId, reviewed: false },
    data: {
      reviewed: true,
      reviewedAt: new Date(),
      reviewedById: (auth.session.user as any)?.id ?? null,
    },
  });

  return NextResponse.json({ count: result.count });
}
