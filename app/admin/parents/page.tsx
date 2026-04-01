import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/header';
import { ParentsClient } from '@/components/admin/parents-client';

export const metadata = { title: 'Responsáveis' };

async function getParentsData(schoolId: string) {
  const parents = await prisma.parent.findMany({
    where: {
      students: {
        some: {
          student: { schoolId },
        },
      },
    },
    include: {
      user: {
        select: { id: true, email: true, image: true, createdAt: true },
      },
      students: {
        include: {
          student: {
            select: { id: true, name: true, class: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  return parents;
}

export default async function ParentsPage() {
  const session = await getServerSession(authOptions);
  const schoolId = (session?.user as any)?.schoolId;
  const parents = await getParentsData(schoolId);

  return (
    <div className="flex flex-col flex-1 page-enter">
      <AdminHeader
        title="Responsáveis"
        subtitle={`${parents.length} responsável${parents.length !== 1 ? 'is' : ''} cadastrado${parents.length !== 1 ? 's' : ''}`}
      />
      <div className="flex-1 p-4 md:p-6">
        <ParentsClient parents={parents} schoolId={schoolId} />
      </div>
    </div>
  );
}
