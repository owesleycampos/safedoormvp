import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ClassesClient } from '@/components/admin/classes-client';

export const metadata = { title: 'Turmas' };

async function getClassesData(schoolId: string) {
  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: {
      id: true, name: true, grade: true, shift: true, createdAt: true,
      _count: { select: { students: true } },
    },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  });
  return classes;
}

export default async function ClassesPage() {
  const session = await getServerSession(authOptions);
  const schoolId = (session?.user as any)?.schoolId;
  const classes = await getClassesData(schoolId);

  return (
    <div className="flex flex-col flex-1">
      <ClassesClient classes={classes} schoolId={schoolId} />
    </div>
  );
}
