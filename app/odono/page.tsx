import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SuperAdminDashboardClient } from './dashboard-client';

export default async function SuperAdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') return null;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Parallel queries for dashboard metrics
  const [
    totalSchools,
    activeSchools,
    totalStudents,
    totalParents,
    totalEvents,
    eventsThisMonth,
    eventsLastMonth,
    recentSchools,
    schoolsWithSubs,
    recentLogs,
    awsAccounts,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { status: 'ACTIVE' } }),
    prisma.student.count(),
    prisma.parent.count(),
    prisma.attendanceEvent.count(),
    prisma.attendanceEvent.count({ where: { timestamp: { gte: thisMonthStart } } }),
    prisma.attendanceEvent.count({ where: { timestamp: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        _count: { select: { students: true, admins: true } },
        subscription: { select: { plan: true, status: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      include: { school: { select: { name: true } } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.awsAccount.findMany(),
  ]);

  // Calculate MRR from active subscriptions
  const mrr = schoolsWithSubs.reduce((acc, sub) => {
    const monthly = sub.billing === 'ANNUAL'
      ? Math.round(sub.priceMonthly * (1 - sub.discount))
      : sub.priceMonthly;
    return acc + monthly;
  }, 0);

  const arr = mrr * 12;
  const eventsGrowth = eventsLastMonth > 0
    ? Math.round(((eventsThisMonth - eventsLastMonth) / eventsLastMonth) * 100)
    : 0;

  const data = {
    totalSchools,
    activeSchools,
    suspendedSchools: totalSchools - activeSchools,
    totalStudents,
    totalParents,
    totalEvents,
    eventsThisMonth,
    eventsGrowth,
    mrr,
    arr,
    activeSubscriptions: schoolsWithSubs.length,
    recentSchools: recentSchools.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      students: s._count.students,
      admins: s._count.admins,
      plan: s.subscription?.plan || null,
      subStatus: s.subscription?.status || null,
      createdAt: s.createdAt.toISOString(),
    })),
    recentLogs: recentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      createdAt: l.createdAt.toISOString(),
      metadata: l.metadata,
    })),
    awsAccounts: awsAccounts.map((a) => ({
      id: a.id,
      label: a.label,
      status: a.status,
      usedCollections: a.usedCollections,
      maxCollections: a.maxCollections,
      currentSpend: a.currentSpend,
      monthlyBudget: a.monthlyBudget,
    })),
  };

  return <SuperAdminDashboardClient data={data} />;
}
