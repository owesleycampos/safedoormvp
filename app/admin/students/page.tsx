import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { StudentsClient } from '@/components/admin/students-client';

export const metadata = { title: 'Alunos' };

async function getStudentsData(schoolId: string) {
  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, isActive: true },
      // Antes era um include cego: trazia os BYTES da biometria legada
      // (faceVector) de todos os alunos e a árvore completa responsável→
      // usuário — payload que a lista nunca exibia (a ficha carrega os
      // responsáveis pela API dela). Só o que a tela consome:
      select: {
        id: true, name: true, isActive: true, photoUrl: true,
        classId: true, birthDate: true, notes: true,
        recognitionEnabled: true, azurePersonId: true,
        biometricConsentAt: true, biometricConsentName: true,
        class: { select: { id: true, name: true, grade: true } },
        photos: { where: { isProfile: true }, take: 1, select: { id: true, url: true } },
        _count: { select: { photos: true, parents: true } },
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
