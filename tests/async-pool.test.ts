/**
 * Testes do teto de concorrência dos crons.
 * Rodar com: npx tsx tests/async-pool.test.ts
 */
import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../lib/async-pool';

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('\n── async-pool: mapWithConcurrency ──');

  await test('preserva a ordem dos resultados (results[i] = f(items[i]))', async () => {
    const items = [10, 40, 20, 5, 30];
    // atrasos diferentes: sem preservação de ordem, a saída sairia embaralhada
    const out = await mapWithConcurrency(items, 2, async (n) => {
      await delay(n);
      return n * 2;
    });
    assert.deepEqual(out, [20, 80, 40, 10, 60]);
  });

  await test('nunca ultrapassa o teto de tarefas em voo', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(5);
      inFlight--;
      return null;
    });
    assert.ok(maxInFlight <= 4, `maxInFlight=${maxInFlight} passou de 4`);
    assert.ok(maxInFlight >= 2, `paralelismo não aconteceu (maxInFlight=${maxInFlight})`);
  });

  await test('processa todos os itens exatamente uma vez', async () => {
    const seen: number[] = [];
    await mapWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 8, async (n) => {
      seen.push(n);
      return n;
    });
    assert.equal(seen.length, 50);
    assert.equal(new Set(seen).size, 50);
  });

  await test('lista vazia não quebra', async () => {
    const out = await mapWithConcurrency([], 4, async () => 1);
    assert.deepEqual(out, []);
  });

  console.log(`\n${passed} testes passaram.\n`);
})();
