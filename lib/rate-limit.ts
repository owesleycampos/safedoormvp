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

/**
 * Só CONSULTA o balde, sem gastar tentativa. Use junto de rateLimitRecord
 * quando só o FRACASSO deve contar (login): assim quem acerta a senha nunca é
 * penalizado, e quem só erra é barrado.
 */
export function rateLimitPeek(key: string, limit: number): boolean {
  const w = windows.get(key);
  if (!w || w.resetAt <= Date.now()) return true;
  return w.count < limit;
}

/** Registra UMA tentativa falha no balde. */
export function rateLimitRecord(key: string, windowMs: number): void {
  const now = Date.now();
  sweep(now);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) windows.set(key, { count: 1, resetAt: now + windowMs });
  else w.count += 1;
}

/**
 * IP do chamador atrás do proxy da Vercel.
 *
 * NÃO usa o primeiro item de x-forwarded-for: aquele hop é fornecido pelo
 * CLIENTE e pode ser forjado (`X-Forwarded-For: 1.2.3.4` rotativo dava um balde
 * novo a cada request, anulando o limite). A ordem aqui vai do mais confiável
 * para o menos: cabeçalhos que o próprio proxy escreve primeiro e, só como
 * último recurso, o hop MAIS À DIREITA do XFF (o que o proxy anexou).
 */
export function clientIp(req: HeaderSource): string {
  const h = (name: string) => readHeader(req, name);
  const xff = h('x-forwarded-for');
  const rightMost = xff ? xff.split(',').pop()?.trim() : null;
  return h('x-vercel-forwarded-for') || h('x-real-ip') || rightMost || 'unknown';
}

/**
 * Aceita tanto o Request do Next (headers.get) quanto o objeto simples que o
 * NextAuth entrega ao `authorize` (headers como Record<string,string>).
 */
export type HeaderSource =
  | { headers: { get(name: string): string | null } }
  | { headers?: Record<string, string | string[] | undefined> }
  | undefined
  | null;

function readHeader(req: HeaderSource, name: string): string | null {
  if (!req || !req.headers) return null;
  const headers = req.headers as any;
  if (typeof headers.get === 'function') return headers.get(name);
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === 'string' ? v : null;
}
