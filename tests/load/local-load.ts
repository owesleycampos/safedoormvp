/**
 * Driver de carga LOCAL (sem k6) — valida o harness ponta a ponta contra o dev
 * server antes de apontar pro staging. Espelha o recognize.k6.js: lê os pares
 * de load-fixtures.json e dispara POSTs concorrentes em /api/events/checkin-checkout
 * em degraus de concorrência, medindo latência (p50/p95/p99), throughput e erro.
 *
 * Uso:
 *   BASE=http://localhost:3010 npx tsx tests/load/local-load.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3010';
type Pair = { deviceKey: string; studentId: string };
const pairs: Pair[] = JSON.parse(readFileSync(join(__dirname, 'load-fixtures.json'), 'utf8'));

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function fireOne(): Promise<{ ms: number; status: number }> {
  const p = pairs[Math.floor(Math.random() * pairs.length)];
  const eventType = Math.random() < 0.5 ? 'ENTRY' : 'EXIT';
  const t0 = performance.now();
  let status = 0;
  try {
    const r = await fetch(`${BASE}/api/events/checkin-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-api-key': p.deviceKey },
      body: JSON.stringify({ studentId: p.studentId, eventType, confidence: 0.97 }),
    });
    status = r.status;
    await r.text();
  } catch {
    status = 0;
  }
  return { ms: performance.now() - t0, status };
}

/** Mantém `concurrency` requisições em voo por `durationMs`. */
async function stage(concurrency: number, durationMs: number) {
  const lat: number[] = [];
  const codes = new Map<number, number>();
  const until = performance.now() + durationMs;
  let inFlight = 0;
  let done = 0;

  await new Promise<void>((resolve) => {
    function pump() {
      while (inFlight < concurrency && performance.now() < until) {
        inFlight++;
        fireOne().then(({ ms, status }) => {
          lat.push(ms);
          codes.set(status, (codes.get(status) || 0) + 1);
          done++;
          inFlight--;
          if (performance.now() < until) pump();
          else if (inFlight === 0) resolve();
        });
      }
      if (inFlight === 0 && performance.now() >= until) resolve();
    }
    pump();
  });

  lat.sort((a, b) => a - b);
  const errors = Array.from(codes.entries())
    .filter(([s]) => s === 0 || s >= 500)
    .reduce((a, [, n]) => a + n, 0);
  const rps = done / (durationMs / 1000);
  const codeStr = Array.from(codes.entries()).sort().map(([s, n]) => `${s}:${n}`).join(' ');
  console.log(
    `  conc=${String(concurrency).padStart(3)} | reqs=${String(done).padStart(5)} | ` +
    `${rps.toFixed(0).padStart(4)} rps | p50=${pct(lat, 50).toFixed(0)}ms ` +
    `p95=${pct(lat, 95).toFixed(0)}ms p99=${pct(lat, 99).toFixed(0)}ms | ` +
    `5xx/erro=${errors} | [${codeStr}]`
  );
  return { errors, p95: pct(lat, 95) };
}

(async () => {
  console.log(`\n── Carga local contra ${BASE} (${pairs.length} pares) ──`);
  console.log('  (200/201 grava/dedup · 409 cooldown · 429 cota — só 5xx/erro=0 é falha real)\n');
  let worstP95 = 0;
  let totalErrors = 0;
  for (const c of [10, 25, 50, 100]) {
    const { errors, p95 } = await stage(c, 8000);
    totalErrors += errors;
    worstP95 = Math.max(worstP95, p95);
  }
  console.log(`\n  Resumo: pior p95=${worstP95.toFixed(0)}ms | 5xx/erros totais=${totalErrors}`);
  console.log(totalErrors === 0 ? '  ✓ harness ok, sem 5xx sob carga local\n' : '  ✗ houve 5xx/erros — investigar\n');
  if (totalErrors > 0) process.exitCode = 1;
})();
