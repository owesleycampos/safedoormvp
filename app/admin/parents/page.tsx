import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ParentsClient } from '@/components/admin/parents-client';

export const metadata = { title: 'Responsáveis' };

async function getParentsData(schoolId: string) {
  const parents = await prisma.parent.findMany({
    where: {
      OR: [
        // vinculados a algum aluno desta escola
        { students: { some: { student: { schoolId } } } },
        // ...e os que ESTA escola cadastrou e ainda não vinculou a ninguém.
        // Sem este ramo, o botão "Novo responsável" criava um registro que
        // sumia no F5 (a lista só mostrava vinculados) e recriá-lo devolvia
        // 409 "já existe" — a secretária ficava sem saída.
        { students: { none: {} }, user: { schoolId } },
      ],
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
  // Sem escola o Prisma removeria os filtros e a lista alcançaria outras escolas.
  const parents = schoolId ? await getParentsData(schoolId) : [];

  return (
    <div className="flex flex-col flex-1">
      <ParentsClient parents={parents} schoolId={schoolId} />
    </div>
  );
}
