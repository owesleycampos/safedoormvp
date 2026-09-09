/**
 * Testes de CORRIDA (concorrência real) contra o banco de teste.
 *
 * Simula o cenário de escala: muitos reconhecimentos/eventos ao MESMO tempo.
 * Valida as invariantes que "dão erro feio" sob carga:
 *   A. Cota: N frames concorrentes numa escola no teto CAP → exatamente CAP
 *      passam, o contador para em CAP (nunca fura, nunca conta a menos).
 *   B. Isolamento: reservas concorrentes de escolas diferentes não se misturam.
 *   C. Dedup de presença: M requisições idênticas simultâneas → 1 evento só
 *      (precisa do dev server em BASE; pulado se indisponível).
 *
 * Uso:
 *   DATABASE_URL=postgres://...:5544/safedoor_test npx tsx tests/concurrency.test.ts
 *   (BASE opcional, default http://localhost:3010, para o teste C)
 */
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { reserveRecognition, monthKeyFor } from '../lib/recognition-usage';
import { DEFAULT_TIMEZONE } from '../lib/timezone';

const BASE = process.env.BASE || 'http://localhost:3010';
const TZ = DEFAULT_TIMEZONE;
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error('    ', (e as Error).message);
  }
}

async function resetUsage(schoolId: string) {
  const monthKey = monthKeyFor(TZ);
  await prisma.recognitionUsage.upsert({
    where: { schoolId_monthKey: { schoolId, monthKey } },
    create: { schoolId, monthKey, count: 0 },
    update: { count: 0 },
  });
}
async function usageCount(schoolId: string): Promise<number> {
  const row = await prisma.recognitionUsage.findUnique({
    where: { schoolId_monthKey: { schoolId, monthKey: monthKeyFor(TZ) } },
    select: { count: true },
  });
  return row?.count ?? 0;
}

(async () => {
  console.log('\n── Corrida: cota, isolamento e dedup sob concorrência ──');

  const schools = await prisma.school.findMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    select: { id: true, name: true },
    take: 2,
  });
  assert.ok(schools.length >= 1, 'precisa de ao menos 1 escola no banco de teste');

  // ── A. Cota atômica sob 300 reservas concorrentes ────────────────────────
  await test('A. 300 reservas concorrentes no teto CAP=50 → exatamente 50 passam, contador para em 50', async () => {
    const s = schools[0];
    await resetUsage(s.id);
    const CAP = 50;
    const N = 300;
    const results = await Promise.all(
      Array.from({ length: N }, () => reserveRecognition(s.id, CAP, TZ))
    );
    const granted = results.filter(Boolean).length;
    const count = await usageCount(s.id);
    assert.equal(granted, CAP, `passaram ${granted}, esperado ${CAP}`);
    assert.equal(count, CAP, `contador=${count}, esperado ${CAP} (furou o teto ou contou a menos)`);
  });

  // ── A2. Sem teto (cap=0): todas passam e o contador bate exatamente ───────
  await test('A2. cap ilimitado: 200 reservas concorrentes → contador = 200 (sem perder contagem)', async () => {
    const s = schools[0];
    await resetUsage(s.id);
    const N = 200;
    const results = await Promise.all(
      Array.from({ length: N }, () => reserveRecognition(s.id, 0, TZ))
    );
    const granted = results.filter(Boolean).length;
    const count = await usageCount(s.id);
    assert.equal(granted, N);
    assert.equal(count, N, `contador=${count}, esperado ${N} (perdeu contagem sob corrida)`);
  });

  // ── B. Isolamento multi-tenant ───────────────────────────────────────────
  if (schools.length >= 2) {
    await test('B. reservas concorrentes de 2 escolas não se misturam (cada contador bate o seu)', async () => {
      const [a, b] = schools;
      await Promise.all([resetUsage(a.id), resetUsage(b.id)]);
      const NA = 120, NB = 80, CAP = 1000;
      // intercala as duas escolas num único lote concorrente
      const ops = [
        ...Array.from({ length: NA }, () => reserveRecognition(a.id, CAP, TZ)),
        ...Array.from({ length: NB }, () => reserveRecognition(b.id, CAP, TZ)),
      ];
      await Promise.all(ops);
      const [ca, cb] = await Promise.all([usageCount(a.id), usageCount(b.id)]);
      assert.equal(ca, NA, `escola A contou ${ca}, esperado ${NA}`);
      assert.equal(cb, NB, `escola B contou ${cb}, esperado ${NB}`);
    });
  } else {
    console.log('  · B. pulado (só 1 escola no banco)');
  }

  // ── C. Dedup de presença sob requisições idênticas simultâneas ───────────
  let baseUp = false;
  try {
    const r = await fetch(`${BASE}/api/camera/recognize`, { method: 'GET' });
    baseUp = r.status === 200 || r.status === 503;
  } catch { baseUp = false; }

  if (baseUp) {
    await test('C. 20 checkins idênticos simultâneos → 1 evento (dedup segura sob corrida)', async () => {
      const device = await prisma.device.findFirst({ select: { apiKey: true, schoolId: true } });
      assert.ok(device?.apiKey, 'precisa de um device com apiKey');
      const student = await prisma.student.findFirst({ where: { schoolId: device!.schoolId, isActive: true }, select: { id: true } });
      assert.ok(student, 'precisa de um aluno ativo na escola do device');

      const ts = '2026-08-27T07:15:00-03:00';
      const dayKey = '2026-08-27';
      // limpa eventos do dia para este aluno
      await prisma.attendanceEvent.deleteMany({ where: { studentId: student!.id, dayKey } });

      const body = JSON.stringify({ studentId: student!.id, eventType: 'ENTRY', confidence: 0.97, timestamp: ts });
      const reqs = Array.from({ length: 20 }, () =>
        fetch(`${BASE}/api/events/checkin-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-device-api-key': device!.apiKey! },
          body,
        }).then((r) => r.status).catch(() => 0)
      );
      const statuses = await Promise.all(reqs);
      const created = await prisma.attendanceEvent.count({ where: { studentId: student!.id, eventType: 'ENTRY', dayKey } });
      assert.equal(created, 1, `criou ${created} eventos ENTRY (esperado 1). status: ${statuses.join(',')}`);
      await prisma.attendanceEvent.deleteMany({ where: { studentId: student!.id, dayKey } });
    });
  } else {
    console.log(`  · C. pulado (dev server não está em ${BASE})`);
  }

  // restaura o contador da escola de teste
  await resetUsage(schools[0].id);

  console.log(`\n${passed} passaram, ${failed} falharam.\n`);
  await prisma.$disconnect();
  if (failed > 0) process.exitCode = 1;
})();
