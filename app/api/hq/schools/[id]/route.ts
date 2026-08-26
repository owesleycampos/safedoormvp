import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/require-superadmin';
import { DEFAULT_TIMEZONE, dayRangeForDateStr, localDateStr } from '@/lib/timezone';

/**
 * GET /api/hq/schools/[id] — dossiê completo de UMA escola para o dono do
 * SaaS: cadastro, assinatura, uso de reconhecimento do mês (usados/cota/
 * restantes), presença de hoje, dispositivos, faturas e a lista de contas
 * (admins + responsáveis) para abrir a tela como cada um.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const school = await prisma.school.findUnique({
    where: { id: params.id },
    include: {
      settings: true,
      subscription: true,
      _count: { select: { students: true, classes: true, devices: true } },
    },
  });
  if (!school) return NextResponse.json({ error: 'Escola não encontrada.' }, { status: 404 });

  const tz = school.settings?.timezone || DEFAULT_TIMEZONE;
  const todayStr = localDateStr(new Date(), tz);
  const monthKey = todayStr.slice(0, 7);
  const dayRange = dayRangeForDateStr(todayStr, tz);

  const platform = await prisma.platformSettings.findFirst({
    select: { maxRecogEssencial: true, maxRecogProfissional: true, maxRecogPremium: true },
  });
  const plan = school.subscription?.plan;
  const recogCap = !platform || !plan ? 0 :
    plan === 'ESSENCIAL' ? platform.maxRecogEssencial :
    plan === 'PROFISSIONAL' ? platform.maxRecogProfissional :
    platform.maxRecogPremium;

  const [
    activeStudents, parentCount, usage, entriesToday, eventsThisMonth,
    devices, admins, parents, invoices, lastEvent,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId: school.id, isActive: true } }),
    prisma.parent.count({ where: { students: { some: { student: { schoolId: school.id } } } } }),
    prisma.recognitionUsage.findUnique({
      where: { schoolId_monthKey: { schoolId: school.id, monthKey } },
      select: { count: true },
    }),
    prisma.attendanceEvent.count({
      where: { student: { schoolId: school.id }, eventType: 'ENTRY', timestamp: { gte: dayRange.start, lt: dayRange.end } },
    }),
    prisma.attendanceEvent.count({
      where: { student: { schoolId: school.id }, timestamp: { gte: dayRangeForDateStr(monthKey + '-01', tz).start } },
    }),
    prisma.device.findMany({
      where: { schoolId: school.id },
      select: { id: true, name: true, status: true, lastSeen: true, type: true },
    }),
    prisma.user.findMany({
      where: { schoolId: school.id, role: 'ADMIN' },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.parent.findMany({
      where: { students: { some: { student: { schoolId: school.id } } } },
      select: {
        id: true, name: true, phone: true,
        userId: true, user: { select: { email: true } },
        _count: { select: { students: true } },
      },
      take: 200,
      orderBy: { name: 'asc' },
    }),
    prisma.invoice.findMany({
      where: { schoolId: school.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, amount: true, status: true, dueDate: true, paidAt: true, description: true },
    }),
    prisma.attendanceEvent.findFirst({
      where: { student: { schoolId: school.id } },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    }),
  ]);

  const usedRecog = usage?.count ?? 0;

  return NextResponse.json({
    school: {
      id: school.id, name: school.name, cnpj: school.cnpj,
      city: school.city, state: school.state, status: school.status,
      contactEmail: school.contactEmail, contactPhone: school.contactPhone,
      logoUrl: school.logoUrl, createdAt: school.createdAt,
      timezone: tz,
      recognitionPaused: school.settings?.recognitionPaused ?? false,
    },
    subscription: school.subscription && {
      plan: school.subscription.plan, status: school.subscription.status,
      billing: school.subscription.billing, priceMonthly: school.subscription.priceMonthly,
      discount: school.subscription.discount, trialEndsAt: school.subscription.trialEndsAt,
    },
    counts: {
      students: activeStudents,
      classes: school._count.classes,
      parents: parentCount,
      devices: school._count.devices,
    },
    recognition: {
      usedThisMonth: usedRecog,
      cap: recogCap,
      remaining: recogCap > 0 ? Math.max(0, recogCap - usedRecog) : null,
      monthKey,
    },
    today: { entries: entriesToday, presenceRate: activeStudents > 0 ? Math.round((entriesToday / activeStudents) * 100) : 0 },
    eventsThisMonth,
    lastEventAt: lastEvent?.timestamp ?? null,
    devices,
    admins,
    parents,
    invoices,
  });
}
