import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/require-superadmin';
import { DEFAULT_TIMEZONE, localDateStr } from '@/lib/timezone';

/**
 * GET /api/hq/metrics — métricas apuradas do SaaS para o console do dono:
 * escolas por status, MRR e receita, alunos, reconhecimentos do mês (total
 * e top consumidores), saúde de dispositivos e a contingência global.
 */
export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const monthKey = localDateStr(new Date(), DEFAULT_TIMEZONE).slice(0, 7);

  const [
    schoolsByStatus, subscriptions, totalStudents, activeStudents,
    totalParents, platform, usageThisMonth, deviceHealth, topUsage,
    trialsEnding,
  ] = await Promise.all([
    prisma.school.groupBy({ by: ['status'], _count: true }),
    prisma.subscription.findMany({ select: { plan: true, status: true, priceMonthly: true, discount: true, billing: true } }),
    prisma.student.count(),
    prisma.student.count({ where: { isActive: true } }),
    prisma.parent.count(),
    prisma.platformSettings.findFirst({
      select: { recognitionPaused: true, maxRecogEssencial: true, maxRecogProfissional: true, maxRecogPremium: true },
    }),
    prisma.recognitionUsage.aggregate({ where: { monthKey }, _sum: { count: true } }),
    prisma.device.groupBy({ by: ['status'], _count: true }),
    prisma.recognitionUsage.findMany({
      where: { monthKey }, orderBy: { count: 'desc' }, take: 5,
      select: { schoolId: true, count: true },
    }),
    prisma.subscription.findMany({
      where: { status: 'TRIAL', trialEndsAt: { not: null } },
      select: { schoolId: true, trialEndsAt: true },
      orderBy: { trialEndsAt: 'asc' },
      take: 10,
    }),
  ]);

  // MRR: soma dos planos ativos, normalizando anual para mensal e aplicando desconto.
  let mrrCents = 0;
  for (const sub of subscriptions) {
    if (sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') continue;
    const net = sub.priceMonthly * (1 - (sub.discount || 0));
    mrrCents += Math.round(net);
  }

  const planCounts: Record<string, number> = {};
  for (const sub of subscriptions) planCounts[sub.plan] = (planCounts[sub.plan] || 0) + 1;

  // Nome das escolas dos top consumidores e dos trials.
  const ids = Array.from(new Set([...topUsage.map(t => t.schoolId), ...trialsEnding.map(t => t.schoolId)]));
  const names = ids.length
    ? await prisma.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string) => names.find(n => n.id === id)?.name ?? id;

  const statusMap: Record<string, number> = {};
  for (const g of schoolsByStatus) statusMap[g.status] = g._count;
  const deviceMap: Record<string, number> = {};
  for (const g of deviceHealth) deviceMap[g.status] = g._count;

  return NextResponse.json({
    schools: {
      total: schoolsByStatus.reduce((a, g) => a + g._count, 0),
      byStatus: statusMap,
    },
    revenue: { mrrCents, arrCents: mrrCents * 12, planCounts },
    students: { total: totalStudents, active: activeStudents },
    parents: totalParents,
    recognition: {
      monthKey,
      totalThisMonth: usageThisMonth._sum.count ?? 0,
      globalPaused: platform?.recognitionPaused ?? false,
      caps: {
        ESSENCIAL: platform?.maxRecogEssencial ?? 0,
        PROFISSIONAL: platform?.maxRecogProfissional ?? 0,
        PREMIUM: platform?.maxRecogPremium ?? 0,
      },
      top: topUsage.map(t => ({ schoolId: t.schoolId, name: nameOf(t.schoolId), count: t.count })),
    },
    devices: deviceMap,
    trialsEnding: trialsEnding.map(t => ({ schoolId: t.schoolId, name: nameOf(t.schoolId), trialEndsAt: t.trialEndsAt })),
  });
}
