import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, localDateStr } from '@/lib/timezone';

/**
 * Medição e cota do reconhecimento facial.
 *
 * A AWS cobra por CHAMADA de SearchFacesByImage (haja match ou não), então a
 * cota do plano é um teto de CHAMADAS por mês — é o que limita o custo. A
 * reserva é ATÔMICA e feita ANTES de chamar a AWS: um updateMany condicional
 * (count < cap) incrementa e diz se havia slot. Assim, mesmo com vários
 * frames simultâneos, nunca se ultrapassa o teto nem se perde contagem
 * (nada de read-then-increment nem fire-and-forget).
 */

// Sem PlatformSettings (instalação nova) NÃO é ilimitado: cai num teto de
// segurança para não gerar custo de AWS sem limite.
const SAFE_FALLBACK_CAP = 20_000;

export function monthKeyFor(tz: string | null | undefined): string {
  return localDateStr(new Date(), tz || DEFAULT_TIMEZONE).slice(0, 7); // "YYYY-MM"
}

export interface RecognitionGate {
  paused: { status: number; error: string } | null;
  cap: number; // 0 = ilimitado (configuração explícita)
  minConfidence: number;
}

/** Verifica contingência (pausa) e devolve cota + minConfidence numa query. */
export async function getRecognitionGate(schoolId: string): Promise<RecognitionGate> {
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
      select: { recognitionPaused: true, minConfidence: true },
    }),
    prisma.subscription.findUnique({ where: { schoolId }, select: { plan: true } }),
  ]);

  const minConfidence = schoolSettings?.minConfidence ?? 0.9;
  const deny = (status: number, error: string): RecognitionGate => ({ paused: { status, error }, cap: 0, minConfidence });

  if (platform?.recognitionPaused) {
    return deny(503, 'Reconhecimento temporariamente pausado pela plataforma. Use o registro manual.');
  }
  if (schoolSettings?.recognitionPaused) {
    return deny(503, 'Reconhecimento pausado para esta escola. Fale com o suporte. O registro manual continua funcionando.');
  }

  let cap: number;
  if (!platform) cap = SAFE_FALLBACK_CAP;
  else if (!subscription) cap = platform.maxRecogEssencial || SAFE_FALLBACK_CAP;
  else cap =
    subscription.plan === 'ESSENCIAL' ? platform.maxRecogEssencial :
    subscription.plan === 'PROFISSIONAL' ? platform.maxRecogProfissional :
    platform.maxRecogPremium;

  return { paused: null, cap, minConfidence };
}

/**
 * Reserva UMA chamada de reconhecimento de forma atômica, ANTES da AWS.
 * Retorna true se havia slot (e já contou), false se a cota estourou.
 * cap=0 significa ilimitado: conta (para métrica) e sempre permite.
 */
export async function reserveRecognition(schoolId: string, cap: number, tz?: string | null): Promise<boolean> {
  const monthKey = monthKeyFor(tz);
  // Garante a linha do mês (idempotente).
  await prisma.recognitionUsage.upsert({
    where: { schoolId_monthKey: { schoolId, monthKey } },
    create: { schoolId, monthKey, count: 0 },
    update: {},
  });

  if (cap > 0) {
    // Incremento CONDICIONAL: só sobe se ainda há slot. Atômico no banco —
    // frames concorrentes não passam do teto.
    const res = await prisma.recognitionUsage.updateMany({
      where: { schoolId, monthKey, count: { lt: cap } },
      data: { count: { increment: 1 } },
    });
    return res.count > 0; // 0 = teto atingido
  }

  await prisma.recognitionUsage.update({
    where: { schoolId_monthKey: { schoolId, monthKey } },
    data: { count: { increment: 1 } },
  });
  return true;
}
