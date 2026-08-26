import { prisma } from '@/lib/db';
import { SchoolsClient } from './schools-client';

export default async function SchoolsPage() {
  const schools = await prisma.school.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { students: true, admins: true, classes: true, devices: true } },
      subscription: { select: { plan: true, status: true, billing: true, priceMonthly: true, discount: true } },
      awsAccount: { select: { label: true, id: true } },
    },
  });

  const data = schools.map((s) => ({
    id: s.id,
    name: s.name,
    cnpj: s.cnpj,
    city: s.city,
    state: s.state,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    status: s.status,
    students: s._count.students,
    admins: s._count.admins,
    classes: s._count.classes,
    devices: s._count.devices,
    plan: s.subscription?.plan || null,
    subStatus: s.subscription?.status || null,
    billing: s.subscription?.billing || null,
    priceMonthly: s.subscription?.priceMonthly || null,
    awsLabel: s.awsAccount?.label || null,
    awsAccountId: s.awsAccountId,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  }));

  return <SchoolsClient schools={data} />;
}
