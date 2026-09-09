import { prisma } from '@/lib/db';
import { BillingClient } from './billing-client';
import { mrrCents } from '@/lib/billing';

export default async function BillingPage() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // The KPIs are aggregated in the database over ALL invoices. They used to be
  // derived from the same `take: 50` slice used for the table, so past 50
  // historical invoices the revenue figures silently under-reported.
  const [subscriptions, invoices, platformSettings, paidAgg, overdueAgg, pendingAgg] =
    await Promise.all([
      prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          school: { select: { id: true, name: true, status: true } },
        },
      }),
      prisma.invoice.findMany({
        orderBy: { dueDate: 'desc' },
        take: 50,
        include: {
          school: { select: { id: true, name: true } },
        },
      }),
      prisma.platformSettings.findFirst(),
      prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.count({ where: { status: 'PENDING' } }),
    ]);

  // MRR pela fonte única (só ACTIVE, desconto só no anual).
  const mrr = mrrCents(subscriptions);

  const data = {
    mrr,
    arr: mrr * 12,
    paidThisMonth: paidAgg._sum.amount ?? 0,
    overdueCount: overdueAgg._count,
    overdueAmount: overdueAgg._sum.amount ?? 0,
    pendingCount: pendingAgg,
    // The table below still shows the 50 most recent invoices; say so.
    invoicesTruncated: invoices.length === 50,
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      schoolId: s.schoolId,
      schoolName: s.school.name,
      schoolStatus: s.school.status,
      plan: s.plan,
      billing: s.billing,
      status: s.status,
      priceMonthly: s.priceMonthly,
      discount: s.discount,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt?.toISOString() || null,
      trialEndsAt: s.trialEndsAt?.toISOString() || null,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      schoolName: i.school.name,
      amount: i.amount,
      status: i.status,
      dueDate: i.dueDate.toISOString(),
      paidAt: i.paidAt?.toISOString() || null,
      paymentMethod: i.paymentMethod,
      description: i.description,
    })),
    settings: platformSettings ? {
      essencialPrice: platformSettings.essencialPrice,
      profissionalPrice: platformSettings.profissionalPrice,
      premiumPrice: platformSettings.premiumPrice,
      annualDiscount: platformSettings.annualDiscount,
      trialDays: platformSettings.trialDays,
    } : null,
  };

  return <BillingClient data={data} />;
}
