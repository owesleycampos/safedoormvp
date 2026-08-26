import { prisma } from '@/lib/db';

/**
 * Limite de alunos por plano — configurado em /odono/settings e, até aqui,
 * aplicado em lugar NENHUM: uma escola ESSENCIAL cadastrava alunos sem fim.
 *
 * Retorna null quando pode criar, ou a mensagem de erro quando estourou.
 * Sem assinatura (escola antiga/demo) não aplica limite.
 */
export async function checkStudentCap(
  schoolId: string,
  adding: number
): Promise<string | null> {
  const [subscription, settings] = await Promise.all([
    prisma.subscription.findUnique({ where: { schoolId }, select: { plan: true } }),
    prisma.platformSettings.findFirst({
      select: {
        maxStudentsEssencial: true,
        maxStudentsProfissional: true,
        maxStudentsPremium: true,
      },
    }),
  ]);
  if (!subscription || !settings) return null;

  const cap =
    subscription.plan === 'ESSENCIAL' ? settings.maxStudentsEssencial :
    subscription.plan === 'PROFISSIONAL' ? settings.maxStudentsProfissional :
    settings.maxStudentsPremium;
  if (!cap || cap <= 0) return null;

  const current = await prisma.student.count({ where: { schoolId, isActive: true } });
  if (current + adding > cap) {
    return `Limite do plano ${subscription.plan} atingido (${current}/${cap} alunos). Fale com o suporte para ampliar.`;
  }
  return null;
}
