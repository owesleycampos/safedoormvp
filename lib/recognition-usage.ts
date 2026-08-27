import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, localDateStr } from '@/lib/timezone';

/**
 * Medição e cota do reconhecimento facial.
 *
 * Conta RECONHECIMENTOS de fato (frames que casaram com um aluno), não
 * todo frame analisado — uma câmera apontada para um corredor vazio não
 * pode consumir a cota. Uma linha por escola/mês.
 */

export function monthKeyFor(tz: string | null | undefined): string {
  return localDateStr(new Date(), tz || DEFAULT_TIMEZONE).slice(0, 7); // "YYYY-MM"
}

/**
 * Verifica contingência (pausa global/por escola) e cota do plano.
 * Retorna null quando pode reconhecer, ou { status, error } para responder.
 */
export type RecognitionGate =
  | { blocked: { status: number; error: string }; minConfidence: number }
  | { blocked: null; minConfidence: number };

export async function checkRecognitionAllowed(
  schoolId: string,
  tz?: string | null
): Promise<RecognitionGate> {
  const [platform, schoolSettings, subscription] = await Promise.all([
    prisma.platformSettings.findFirst({
      select: {
        recognitionPaused: true,
        maxRecogEssencial: true,
        maxRecogProfissional: true,
        maxRecogPremium: true,
      },
    }),
    // minConfidence sai daqui também — o route buscava a MESMA linha de novo.
    prisma.schoolSettings.findUnique({
      where: { schoolId },
      select: { recognitionPaused: true, minConfidence: true },
    }),
    prisma.subscription.findUnique({ where: { schoolId }, select: { plan: true } }),
  ]);

  const minConfidence = schoolSettings?.minConfidence ?? 0.9;
  const deny = (status: number, error: string) => ({ blocked: { status, error }, minConfidence });

  if (platform?.recognitionPaused) {
    return deny(503, 'Reconhecimento temporariamente pausado pela plataforma. Use o registro manual.');
  }
  if (schoolSettings?.recognitionPaused) {
    return deny(503, 'Reconhecimento pausado para esta escola. Fale com o suporte. O registro manual continua funcionando.');
  }

  // Sem plataforma/assinatura: cap indefinido. NÃO é ilimitado — cai no
  // menor teto conhecido (Essencial) para uma escola sem plano ativo não
  // gerar custo de AWS sem limite. cap<=0 (config 0) segue como ilimitado.
  let cap: number;
  if (!platform) cap = 0;
  else if (!subscription) cap = platform.maxRecogEssencial;
  else cap =
    subscription.plan === 'ESSENCIAL' ? platform.maxRecogEssencial :
    subscription.plan === 'PROFISSIONAL' ? platform.maxRecogProfissional :
    platform.maxRecogPremium;

  if (cap && cap > 0) {
    const usage = await prisma.recognitionUsage.findUnique({
      where: { schoolId_monthKey: { schoolId, monthKey: monthKeyFor(tz) } },
      select: { count: true },
    });
    if ((usage?.count ?? 0) >= cap) {
      return deny(429, `Cota mensal de reconhecimentos do plano atingida (${cap.toLocaleString('pt-BR')}). O registro manual continua funcionando.`);
    }
  }
  return { blocked: null, minConfidence };
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
