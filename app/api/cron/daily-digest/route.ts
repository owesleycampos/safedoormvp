/**
 * GET /api/cron/daily-digest — resumo da manhã para a direção.
 *
 * Meio da manhã, cada admin inscrito em push recebe: presentes, ausentes e
 * os nomes de quem faltou — a lista que a secretaria usa para ligar aos
 * responsáveis. Transforma o dado coletado em rotina operacional diária.
 * Quando o WhatsApp estiver configurado, o mesmo texto seguirá por lá
 * (número do admin no cadastro — fase seguinte).
 *
 * Idempotência: AuditLog (action DIGEST_SENT, entityId schoolId+dayKey)
 * impede reenvio no mesmo dia. Roda com segurança em qualquer frequência.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveSchedule, timeToMinutes } from '@/lib/attendance-rules';
import { DEFAULT_TIMEZONE, dayRangeInTz, isWeekendDateStr, localMinutes } from '@/lib/timezone';
import { sendPushToSubscription } from '@/lib/notifications';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get('authorization');
  return bearer === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  // Override de relógio APENAS fora de produção, para a suíte de testes
  // exercitar "às 8h30 de uma quarta" sem depender da hora real da máquina.
  const nowParam = url.searchParams.get('now');
  const now =
    process.env.NODE_ENV !== 'production' && nowParam ? new Date(nowParam) : new Date();

  const schools = await prisma.school.findMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    select: {
      id: true,
      name: true,
      settings: {
        select: {
          entryStartTime: true, entryEndTime: true,
          exitStartTime: true, exitEndTime: true,
          shiftSchedules: true, timezone: true,
        },
      },
      classes: { select: { id: true, shift: true } },
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  const results: Array<{ school: string; shift: string; present: number; absent: number; sentTo: number }> = [];

  for (const school of schools) {
    const tz = school.settings?.timezone || DEFAULT_TIMEZONE;
    const day = dayRangeInTz(now, tz);
    if (isWeekendDateStr(day.dateStr)) continue;
    const nowMin = localMinutes(now, tz);

    // Cada TURNO é resumido separadamente, com trava própria. A chave antiga
    // era só por dia: o run da manhã fechava a trava e os turnos da tarde/
    // noite nunca eram resumidos. Agrupa as turmas por turno e processa só os
    // turnos cuja entrada já fechou (+60min).
    const byShift = new Map<string, string[]>();
    for (const c of school.classes) {
      const sched = resolveSchedule(c.shift, school.settings ?? null);
      if (!sched) continue;
      if (nowMin < timeToMinutes(sched.entryLimit) + 60) continue;
      const key = c.shift || 'GERAL';
      const arr = byShift.get(key) || [];
      arr.push(c.id);
      byShift.set(key, arr);
    }
    if (byShift.size === 0) continue;

    for (const [shiftKey, classIds] of Array.from(byShift.entries())) {
      // Só as ENTRADAS das turmas deste turno — senão o resumo da manhã
      // contava alunos da tarde como "presentes".
      const [students, entries] = await Promise.all([
        prisma.student.findMany({
          where: { schoolId: school.id, isActive: true, classId: { in: classIds } },
          select: { id: true, name: true },
        }),
        prisma.attendanceEvent.findMany({
          where: {
            student: { schoolId: school.id, classId: { in: classIds } },
            eventType: 'ENTRY',
            timestamp: { gte: day.start, lt: day.end },
          },
          select: { studentId: true },
          distinct: ['studentId'],
        }),
      ]);
      if (students.length === 0 || entries.length === 0) continue; // turno sem aula hoje

      const presentIds = new Set(entries.map((e) => e.studentId));
      const absentees = students.filter((s) => !presentIds.has(s.id));

      // Idempotência ATÔMICA por ESCOLA+DIA+TURNO. Uma segunda execução do
      // mesmo turno falha aqui (P2002) e não reenvia; a tarde tem chave
      // própria e é enviada quando fecha.
      const runKey = `${day.dateStr}:${shiftKey}`;
      if (!dryRun) {
        try {
          await prisma.cronRun.create({ data: { job: 'daily-digest', dayKey: runKey, schoolId: school.id } });
        } catch {
          continue; // este turno já foi resumido hoje
        }
      }

      const names = absentees.slice(0, 8).map((s) => s.name.split(' ').slice(0, 2).join(' '));
      const more = absentees.length > 8 ? ` e mais ${absentees.length - 8}` : '';
      const body = absentees.length === 0
        ? `Todos os ${students.length} alunos presentes hoje. 🎉`
        : `${presentIds.size} presentes, ${absentees.length} ausentes: ${names.join(', ')}${more}. Veja a Chamada Diária para contatar os responsáveis.`;

      results.push({ school: school.name, shift: shiftKey, present: presentIds.size, absent: absentees.length, sentTo: school.pushSubscriptions.length });
      if (dryRun) continue;

      // Fan-out de push em paralelo — antes serializava um round-trip por
      // inscrição dentro da mesma invocação compartilhada com todas as escolas.
      const outcomes = await Promise.all(
        school.pushSubscriptions.map((sub) =>
          sendPushToSubscription(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            {
              title: `Porta Segura — Resumo de hoje`,
              body,
              tag: `digest-${day.dateStr}-${shiftKey}`,
              data: { type: 'digest', url: '/admin/attendance' },
            },
            sub.id
          )
        )
      );
      const delivered = outcomes.filter(Boolean).length;

      await prisma.auditLog.create({
        data: {
          action: 'DIGEST_SENT',
          entityType: 'School',
          entityId: `${school.id}:${runKey}`,
          metadata: JSON.stringify({ shift: shiftKey, present: presentIds.size, absent: absentees.length, delivered }),
        },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, dryRun, digests: results });
}
