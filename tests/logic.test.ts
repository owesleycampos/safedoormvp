/**
 * Pure-logic tests: timezone math and attendance rules.
 * Run with: npx tsx tests/logic.test.ts
 */
import assert from 'node:assert/strict';
import {
  localMinutes,
  localDateStr,
  zonedMidnightUtc,
  dayRangeInTz,
  dayRangeForDateStr,
  addDaysStr,
  weekdayOfDateStr,
  isWeekendDateStr,
} from '../lib/timezone';
import {
  resolveSchedule,
  computeStatus,
  timeToMinutes,
  DEFAULT_SHIFT_SCHEDULES,
} from '../lib/attendance-rules';
import { monthlyRevenueCents, mrrCents } from '../lib/billing';
import { isImpersonationExpired } from '../lib/impersonation';

const SP = 'America/Sao_Paulo';
let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('\n── timezone.ts ──');

test('localMinutes: 10:20 UTC = 07:20 in São Paulo (UTC-3)', () => {
  const d = new Date('2026-08-24T10:20:00Z');
  assert.equal(localMinutes(d, SP), 7 * 60 + 20);
});

test('localMinutes: 01:00 UTC = 22:00 previous day in São Paulo', () => {
  const d = new Date('2026-08-25T01:00:00Z');
  assert.equal(localMinutes(d, SP), 22 * 60);
});

test('localDateStr: 01:00 UTC belongs to the PREVIOUS local day', () => {
  const d = new Date('2026-08-25T01:00:00Z');
  assert.equal(localDateStr(d, SP), '2026-08-24');
});

test('localDateStr: 12:00 UTC is the same local day', () => {
  const d = new Date('2026-08-24T12:00:00Z');
  assert.equal(localDateStr(d, SP), '2026-08-24');
});

test('zonedMidnightUtc: SP midnight = 03:00 UTC', () => {
  const d = zonedMidnightUtc('2026-08-24', SP);
  assert.equal(d.toISOString(), '2026-08-24T03:00:00.000Z');
});

test('dayRangeInTz: a 22:00 local event falls inside its local day', () => {
  const event = new Date('2026-08-25T01:00:00Z'); // 22:00 on Aug 24 in SP
  const range = dayRangeInTz(event, SP);
  assert.equal(range.dateStr, '2026-08-24');
  assert.ok(event >= range.start && event < range.end);
});

test('dayRangeForDateStr covers exactly 24h for a normal day', () => {
  const range = dayRangeForDateStr('2026-08-24', SP);
  assert.equal(range.end.getTime() - range.start.getTime(), 24 * 3600 * 1000);
});

test('addDaysStr crosses month boundaries', () => {
  assert.equal(addDaysStr('2026-08-31', 1), '2026-09-01');
  assert.equal(addDaysStr('2026-09-01', -1), '2026-08-31');
});

test('weekdayOfDateStr / isWeekendDateStr: 2026-08-24 is Monday, 2026-08-23 is Sunday', () => {
  assert.equal(weekdayOfDateStr('2026-08-24'), 1);
  assert.equal(isWeekendDateStr('2026-08-24'), false);
  assert.equal(isWeekendDateStr('2026-08-23'), true);
});

test('Manaus (UTC-4) shifts the same instant to a different wall clock', () => {
  const d = new Date('2026-08-24T10:20:00Z');
  assert.equal(localMinutes(d, 'America/Manaus'), 6 * 60 + 20);
});

console.log('\n── attendance-rules.ts ──');

const baseSettings = {
  entryStartTime: '06:00',
  entryEndTime: '09:00',
  exitStartTime: '11:00',
  exitEndTime: '18:00',
  shiftSchedules: null as string | null,
};

test('resolveSchedule: school-configured shift JSON wins over defaults', () => {
  const s = resolveSchedule('MANHA', {
    ...baseSettings,
    shiftSchedules: JSON.stringify({ MANHA: { entry: '08:00', entryLimit: '08:15', exit: '13:00' } }),
  });
  assert.deepEqual(s, { entry: '08:00', entryLimit: '08:15', exit: '13:00' });
});

test('resolveSchedule: shift without JSON falls back to built-in shift defaults', () => {
  const s = resolveSchedule('TARDE', baseSettings);
  assert.deepEqual(s, DEFAULT_SHIFT_SCHEDULES.TARDE);
});

test('resolveSchedule: no shift → school-wide windows', () => {
  const s = resolveSchedule(null, baseSettings);
  assert.deepEqual(s, { entry: '06:00', entryLimit: '09:00', exit: '11:00' });
});

test('resolveSchedule: invalid JSON degrades gracefully to defaults', () => {
  const s = resolveSchedule('MANHA', { ...baseSettings, shiftSchedules: '{broken' });
  assert.deepEqual(s, DEFAULT_SHIFT_SCHEDULES.MANHA);
});

test('resolveSchedule: no shift and no settings → null (no status)', () => {
  assert.equal(resolveSchedule(null, null), null);
});

const manha = DEFAULT_SHIFT_SCHEDULES.MANHA; // entry 07:00, limit 07:30, exit 12:00

test('computeStatus: entry before the limit is ON_TIME', () => {
  assert.equal(computeStatus(manha, 'ENTRY', timeToMinutes('07:20')), 'ON_TIME');
});

test('computeStatus: entry exactly at the limit is ON_TIME', () => {
  assert.equal(computeStatus(manha, 'ENTRY', timeToMinutes('07:30')), 'ON_TIME');
});

test('computeStatus: entry after the limit is ATRASO', () => {
  assert.equal(computeStatus(manha, 'ENTRY', timeToMinutes('07:31')), 'ATRASO');
});

test('computeStatus: exit before the exit time is SAIDA_ANTECIPADA', () => {
  assert.equal(computeStatus(manha, 'EXIT', timeToMinutes('11:50')), 'SAIDA_ANTECIPADA');
});

test('computeStatus: exit at/after the exit time is ON_TIME', () => {
  assert.equal(computeStatus(manha, 'EXIT', timeToMinutes('12:00')), 'ON_TIME');
});

test('computeStatus: null schedule yields null status', () => {
  assert.equal(computeStatus(null, 'ENTRY', 500), null);
});

console.log('\n── the original timezone bug, end to end ──');

test('a 07:20 BRT arrival evaluated on a UTC server is ON_TIME (was ATRASO before the fix)', () => {
  // 07:20 in São Paulo = 10:20 UTC. The old code compared getHours() (10:20
  // on a UTC server) against the 07:30 limit and flagged every punctual
  // student as late. The tz-aware path must say ON_TIME.
  const arrival = new Date('2026-08-24T10:20:00Z');
  const status = computeStatus(manha, 'ENTRY', localMinutes(arrival, SP));
  assert.equal(status, 'ON_TIME');
});

test('a NOITE-shift 22:00 BRT exit stays on its own local day', () => {
  const exit = new Date('2026-08-25T01:00:00Z'); // 22:00 Aug 24 in SP
  const range = dayRangeInTz(exit, SP);
  assert.equal(range.dateStr, '2026-08-24');
  const noite = DEFAULT_SHIFT_SCHEDULES.NOITE;
  assert.equal(computeStatus(noite, 'EXIT', localMinutes(exit, SP)), 'ON_TIME');
});

console.log('\n── billing.ts (fonte única de MRR) ──');

test('mensal ativo: preço cheio, desconto ignorado (desconto é do anual)', () => {
  assert.equal(monthlyRevenueCents({ status: 'ACTIVE', billing: 'MONTHLY', priceMonthly: 10000, discount: 0.2 }), 10000);
});

test('anual ativo: desconto aplicado', () => {
  assert.equal(monthlyRevenueCents({ status: 'ACTIVE', billing: 'ANNUAL', priceMonthly: 10000, discount: 0.2 }), 8000);
});

test('TRIAL não é receita', () => {
  assert.equal(monthlyRevenueCents({ status: 'TRIAL', billing: 'MONTHLY', priceMonthly: 10000, discount: 0 }), 0);
});

test('CANCELLED não é receita', () => {
  assert.equal(monthlyRevenueCents({ status: 'CANCELLED', billing: 'ANNUAL', priceMonthly: 10000, discount: 0.1 }), 0);
});

test('mrrCents soma só as ativas — Monitor e Dashboard batem', () => {
  const subs = [
    { status: 'ACTIVE', billing: 'MONTHLY', priceMonthly: 10000, discount: 0.3 }, // 10000
    { status: 'ACTIVE', billing: 'ANNUAL', priceMonthly: 20000, discount: 0.1 },  // 18000
    { status: 'TRIAL', billing: 'MONTHLY', priceMonthly: 5000, discount: 0 },     // 0
  ];
  assert.equal(mrrCents(subs), 28000);
});

console.log('\n── impersonação: prazo absoluto (não depende do cookie rolante) ──');

test('sessão normal (sem impersonatedBy) nunca expira por aqui', () => {
  assert.equal(isImpersonationExpired({ impExp: 1 }, 999999999999), false);
});

test('impersonação dentro do prazo continua válida', () => {
  const now = 1_000_000;
  assert.equal(isImpersonationExpired({ impersonatedBy: 'u1', impExp: now + 60_000 }, now), false);
});

test('impersonação vencida expira mesmo com cookie renovado', () => {
  const now = 2_000_000;
  assert.equal(isImpersonationExpired({ impersonatedBy: 'u1', impExp: now - 1 }, now), true);
});

test('impersonação sem impExp não força expiração (degrada seguro)', () => {
  assert.equal(isImpersonationExpired({ impersonatedBy: 'u1' }, 999999999999), false);
});

console.log(`\n${passed} tests passed.\n`);
