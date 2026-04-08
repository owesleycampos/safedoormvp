import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { StudentsClient } from '@/components/admin/students-client';

export const metadata = { title: 'Alunos' };

async function getStudentsData(schoolId: string) {
  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, isActive: true },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        photos: { where: { isProfile: true }, take: 1 },
        parents: {
          include: {
            parent: {
              include: { user: { select: { email: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.class.findMany({
      where: { schoolId },
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
    }),
  ]);
  return { students, classes };
}

export default async function StudentsPage() {
  const session = await getServerSession(authOptions);
  const schoolId = (session?.user as any)?.schoolId;
  const { students, classes } = await getStudentsData(schoolId);

  return (
    <div className="flex flex-col flex-1">
      <StudentsClient students={students} classes={classes} />
    </div>
  );
}
