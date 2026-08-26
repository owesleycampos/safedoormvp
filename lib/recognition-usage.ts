import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, localDateStr } from '@/lib/timezone';

/**
 * Medição e cota do reconhecimento facial.
 *
 * Cada frame analisado é uma chamada COBRADA na AWS — sem medição não há
 * como o dono do SaaS saber quanto cada escola consome, nem aplicar cota,
 * nem agir num estouro de custo. Uma linha por escola/mês.
 */

export function monthKeyFor(tz: string | null | undefined): string {
  return localDateStr(new Date(), tz || DEFAULT_TIMEZONE).slice(0, 7); // "YYYY-MM"
}

/**
 * Verifica contingência (pausa global/por escola) e cota do plano.
 * Retorna null quando pode reconhecer, ou { status, error } para responder.
 */
export async function checkRecognitionAllowed(
  schoolId: string,
  tz?: string | null
): Promise<{ status: number; error: string } | null> {
  const [platform, schoolSettings, subscription] = await Promise.all([
    prisma.platformSettings.findFirst({
      select: {
        recognitionPaused: true,
        maxRecogEssencial: true,
        maxRecogProfissional: true,
        maxRecogPremium: true,
      },
    }),
    prisma.schoolSettings.findUnique({
      where: { schoolId },
      select: { recognitionPaused: true },
    }),
    prisma.subscription.findUnique({ where: { schoolId }, select: { plan: true } }),
  ]);

  if (platform?.recognitionPaused) {
    return { status: 503, error: 'Reconhecimento temporariamente pausado pela plataforma. Use o registro manual.' };
  }
  if (schoolSettings?.recognitionPaused) {
    return { status: 503, error: 'Reconhecimento pausado para esta escola. Fale com o suporte. O registro manual continua funcionando.' };
  }

  const cap = !platform || !subscription ? 0 :
    subscription.plan === 'ESSENCIAL' ? platform.maxRecogEssencial :
    subscription.plan === 'PROFISSIONAL' ? platform.maxRecogProfissional :
    platform.maxRecogPremium;
  if (cap && cap > 0) {
    const usage = await prisma.recognitionUsage.findUnique({
      where: { schoolId_monthKey: { schoolId, monthKey: monthKeyFor(tz) } },
      select: { count: true },
    });
    if ((usage?.count ?? 0) >= cap) {
      return {
        status: 429,
        error: `Cota mensal de reconhecimentos do plano atingida (${cap.toLocaleString('pt-BR')}). O registro manual continua funcionando.`,
      };
    }
  }
  return null;
}

/** Conta 1 chamada de reconhecimento para a escola no mês corrente. */
export async function countRecognitionCall(schoolId: string, tz?: string | null): Promise<void> {
  const monthKey = monthKeyFor(tz);
  await prisma.recognitionUsage.upsert({
    where: { schoolId_monthKey: { schoolId, monthKey } },
    create: { schoolId, monthKey, count: 1 },
    update: { count: { increment: 1 } },
  }).catch(() => {
    // Medição nunca derruba o reconhecimento em si.
  });
}
