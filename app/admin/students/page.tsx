import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/header';
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
    <div className="flex flex-col flex-1 page-enter">
      <AdminHeader
        title="Alunos"
        subtitle={`${students.length} aluno${students.length !== 1 ? 's' : ''} cadastrado${students.length !== 1 ? 's' : ''}`}
      />
      <div className="flex-1 p-4 md:p-6">
        <StudentsClient students={students} classes={classes} />
      </div>
    </div>
  );
}
