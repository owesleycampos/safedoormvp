/*
 * Teste de carga — Porta Segura (k6).
 *
 * Simula o pico real: muitas escolas registrando entradas/saídas ao mesmo tempo
 * pelo endpoint quente `/api/events/checkin-checkout` (o mesmo que o tablet e a
 * câmera usam para gravar presença). Sobe a carga em degraus (≈10 → 50 → 100
 * escolas) e mede latência, taxa de erro e dedup.
 *
 * NUNCA rode contra produção. Use um deploy de STAGING com banco separado
 * (ver docs/LOAD-TESTING.md).
 *
 * Uso:
 *   BASE_URL=https://staging.seuapp.vercel.app \
 *   k6 run --env FIXTURES=tests/load/load-fixtures.json tests/load/recognize.k6.js
 *
 * FIXTURES: JSON [{ "deviceKey": "...", "studentId": "..." }, ...] gerado pelo
 * seeder (tests/load/seed-load.ts). Cada VU sorteia um par e alterna ENTRY/EXIT.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3010';
const FIXTURES = __ENV.FIXTURES || 'tests/load/load-fixtures.json';

// Carregado uma vez e compartilhado entre todos os VUs (não duplica na memória).
const pairs = new SharedArray('pairs', () => JSON.parse(open(`../../${FIXTURES}`)));

const errorRate = new Rate('errors');
const eventLatency = new Trend('event_latency', true);

export const options = {
  // Degraus de carga. Cada VU manda ~1 req a cada ~2s (como a câmera), então
  // ~200 VUs ≈ 100 req/s ≈ 100 escolas com 2 pontos de captura ativos.
  stages: [
    { duration: '30s', target: 20 },   // aquecimento (~10 escolas)
    { duration: '1m', target: 100 },   // ~50 escolas
    { duration: '2m', target: 200 },   // ~100 escolas — o alvo
    { duration: '1m', target: 200 },   // sustenta o pico
    { duration: '30s', target: 0 },    // desaquece
  ],
  thresholds: {
    // Metas de aceitação — ajuste conforme seu SLA:
    http_req_duration: ['p(95)<800', 'p(99)<1500'], // ms
    errors: ['rate<0.01'],                           // < 1% de erro
    event_latency: ['p(95)<800'],
  },
};

export default function () {
  if (pairs.length === 0) {
    throw new Error('Sem fixtures. Gere tests/load/load-fixtures.json com o seeder.');
  }
  const p = pairs[Math.floor(Math.random() * pairs.length)];
  // Alterna entrada/saída para exercitar os dois caminhos (status, dedup, cooldown).
  const eventType = Math.random() < 0.5 ? 'ENTRY' : 'EXIT';

  const res = http.post(
    `${BASE_URL}/api/events/checkin-checkout`,
    JSON.stringify({ studentId: p.studentId, eventType, confidence: 0.97 }),
    { headers: { 'Content-Type': 'application/json', 'x-device-api-key': p.deviceKey }, tags: { name: 'checkin' } }
  );

  eventLatency.add(res.timings.duration);
  // 200/201 = gravado ou deduplicado; 409/429 são respostas VÁLIDAS de negócio
  // (cooldown / cota), não erro de infraestrutura.
  const ok = res.status === 200 || res.status === 201 || res.status === 409 || res.status === 429;
  errorRate.add(!ok);
  check(res, {
    'status aceitável (200/201/409/429)': () => ok,
    'sem 5xx': (r) => r.status < 500,
  });

  sleep(2); // cadência de captura da câmera
}
