import { prisma } from '@/lib/db';
import { BillingClient } from './billing-client';

export default async function BillingPage() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [subscriptions, invoices, platformSettings] = await Promise.all([
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
  ]);

  // Calculate totals
  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL');
  const mrr = activeSubs.reduce((acc, sub) => {
    const monthly = sub.billing === 'ANNUAL'
      ? Math.round(sub.priceMonthly * (1 - sub.discount))
      : sub.priceMonthly;
    return acc + monthly;
  }, 0);

  const paidThisMonth = invoices
    .filter((i) => i.status === 'PAID' && i.paidAt && i.paidAt >= thisMonthStart)
    .reduce((acc, i) => acc + i.amount, 0);

  const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE');
  const pendingInvoices = invoices.filter((i) => i.status === 'PENDING');

  const data = {
    mrr,
    arr: mrr * 12,
    paidThisMonth,
    overdueCount: overdueInvoices.length,
    overdueAmount: overdueInvoices.reduce((acc, i) => acc + i.amount, 0),
    pendingCount: pendingInvoices.length,
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
