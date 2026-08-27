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

// Cache do gate por escola. O gate (pausa/cota/minConfidence) muda raramente —
// ler 3 tabelas a cada frame (câmera manda ~1 frame/2s) é desperdício que, com
// 100 escolas, vira centenas de queries/segundo. Cacheia por 30s POR ESCOLA.
// Só o gate é cacheado; a RESERVA continua atômica e por-frame (nunca fura o
// teto). Custo: uma pausa/mudança de plano leva até 30s para propagar — ok para
// um controle de contingência. Em serverless cada instância tem seu cache; numa
// rajada de frames na mesma instância o ganho é grande.
const GATE_TTL_MS = 30_000;
const gateCache = new Map<string, { gate: RecognitionGate; exp: number }>();

/** Limpa o cache do gate de uma escola (use ao pausar/mudar plano para efeito imediato). */
export function invalidateGateCache(schoolId?: string): void {
  if (schoolId) gateCache.delete(schoolId);
  else gateCache.clear();
}

/** Verifica contingência (pausa) e devolve cota + minConfidence numa query (cacheado 30s). */
export async function getRecognitionGate(schoolId: string): Promise<RecognitionGate> {
  const cached = gateCache.get(schoolId);
  if (cached && cached.exp > Date.now()) return cached.gate;
  const gate = await computeRecognitionGate(schoolId);
  gateCache.set(schoolId, { gate, exp: Date.now() + GATE_TTL_MS });
  return gate;
}

async function computeRecognitionGate(schoolId: string): Promise<RecognitionGate> {
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

  if (cap > 0) {
    // Caminho comum (a linha do mês já existe): UMA escrita — incremento
    // CONDICIONAL atômico, só sobe se ainda há slot. Frames concorrentes não
    // passam do teto.
    let res = await prisma.recognitionUsage.updateMany({
      where: { schoolId, monthKey, count: { lt: cap } },
      data: { count: { increment: 1 } },
    });
    if (res.count > 0) return true;

    // 0 afetadas = linha ausente (1º frame do mês) OU teto atingido. Garante a
    // linha e tenta de novo uma vez; se ainda 0, é teto de verdade.
    await prisma.recognitionUsage.upsert({
      where: { schoolId_monthKey: { schoolId, monthKey } },
      create: { schoolId, monthKey, count: 0 },
      update: {},
    });
    res = await prisma.recognitionUsage.updateMany({
      where: { schoolId, monthKey, count: { lt: cap } },
      data: { count: { increment: 1 } },
    });
    return res.count > 0;
  }

  // Ilimitado (cap=0): conta para métrica e sempre permite — uma escrita.
  await prisma.recognitionUsage.upsert({
    where: { schoolId_monthKey: { schoolId, monthKey } },
    create: { schoolId, monthKey, count: 1 },
    update: { count: { increment: 1 } },
  });
  return true;
}

/**
 * Devolve UMA reserva quando a chamada à AWS NÃO chegou a acontecer (erro de
 * rede, imagem inválida, exceção) — nesse caso não houve cobrança, então o slot
 * reservado antes da chamada tem que voltar. Nunca desce abaixo de 0. Não deve
 * ser chamada em "nenhum rosto encontrado": aí a AWS foi chamada e cobrada.
 */
export async function releaseRecognition(schoolId: string, tz?: string | null): Promise<void> {
  const monthKey = monthKeyFor(tz);
  await prisma.recognitionUsage.updateMany({
    where: { schoolId, monthKey, count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  }).catch(() => {});
}
