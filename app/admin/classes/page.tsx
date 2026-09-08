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
      // Só alunos ATIVOS: contando os removidos (soft delete), a turma exibia
      // "5 alunos" para sempre e o botão de excluir travava com "Mova os 5
      // aluno(s) antes de excluir" — sem nunca chamar a API, que permitiria.
      _count: { select: { students: { where: { isActive: true } } } },
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
