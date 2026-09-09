import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/require-superadmin';
import { invalidateGateCache } from '@/lib/recognition-usage';

/**
 * POST /api/hq/recognition-control
 *   { scope: 'global', paused: boolean }
 *   { scope: 'school', schoolId: string, paused: boolean }
 *
 * Contingência do reconhecimento facial: o dono do SaaS pausa/retoma a
 * plataforma inteira (incidente na AWS, estouro de custo) ou uma escola
 * específica (inadimplência, abuso). O registro manual segue funcionando.
 */
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { scope, schoolId, paused } = await req.json();
  const flag = !!paused;

  if (scope === 'global') {
    const existing = await prisma.platformSettings.findFirst({ select: { id: true } });
    if (existing) {
      await prisma.platformSettings.update({ where: { id: existing.id }, data: { recognitionPaused: flag } });
    } else {
      await prisma.platformSettings.create({ data: { recognitionPaused: flag } });
    }
  } else if (scope === 'school' && schoolId) {
    await prisma.schoolSettings.upsert({
      where: { schoolId },
      create: { schoolId, recognitionPaused: flag },
      update: { recognitionPaused: flag },
    });
  } else {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
  }

  // Efeito imediato nesta instância (o cache do gate expira sozinho em 30s nas
  // demais instâncias serverless): pausa global limpa tudo, escola limpa a sua.
  invalidateGateCache(scope === 'global' ? undefined : schoolId);

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: flag ? 'HQ_RECOGNITION_PAUSED' : 'HQ_RECOGNITION_RESUMED',
      entityType: scope === 'global' ? 'Platform' : 'School',
      entityId: scope === 'global' ? null : schoolId,
      metadata: JSON.stringify({ scope }),
    },
  });

  return NextResponse.json({ ok: true, paused: flag });
}
