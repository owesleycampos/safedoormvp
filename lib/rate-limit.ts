/**
 * Rate-limit em memória, por instância serverless.
 *
 * Não é um limitador distribuído (cada instância da Vercel tem o seu mapa),
 * mas transforma um endpoint público de tentativa-de-senha/data-de-nascimento
 * de "ilimitado" em "algumas tentativas por minuto por origem" — que é o que
 * mata força bruta prática. Se um dia houver Redis, este é o único arquivo
 * a trocar.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Limpeza preguiçosa: sem timers (serverless congela), varre no próprio hit.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  windows.forEach((w, k) => {
    if (w.resetAt <= now) windows.delete(k);
  });
}

/**
 * Retorna true se a chamada está DENTRO do limite (e conta a tentativa).
 * @param key     identifica a origem (ex.: `claim:${ip}:${token}`)
 * @param limit   tentativas permitidas por janela
 * @param windowMs tamanho da janela em ms
 */
export function rateLimitOk(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

/** IP do chamador atrás do proxy da Vercel. */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
