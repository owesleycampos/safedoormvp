import { prisma } from '@/lib/db';
import { AwsClient } from './aws-client';

export default async function AwsPage() {
  const [awsAccounts, schools] = await Promise.all([
    prisma.awsAccount.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        schools: {
          select: { id: true, name: true, _count: { select: { students: true } } },
        },
      },
    }),
    prisma.school.findMany({
      where: { awsAccountId: null },
      select: { id: true, name: true },
    }),
  ]);

  const data = {
    accounts: awsAccounts.map((a) => ({
      id: a.id,
      label: a.label,
      accountId: a.accountId,
      region: a.region,
      status: a.status,
      maxCollections: a.maxCollections,
      usedCollections: a.usedCollections,
      maxFacesPerCol: a.maxFacesPerCol,
      monthlyBudget: a.monthlyBudget,
      currentSpend: a.currentSpend,
      lastSyncAt: a.lastSyncAt?.toISOString() || null,
      notes: a.notes,
      schools: a.schools.map((s) => ({
        id: s.id,
        name: s.name,
        students: s._count.students,
      })),
    })),
    unassignedSchools: schools,
  };

  return <AwsClient data={data} />;
}
