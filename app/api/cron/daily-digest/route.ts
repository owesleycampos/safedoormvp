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

  const results: Array<{ school: string; present: number; absent: number; sentTo: number }> = [];

  for (const school of schools) {
    const tz = school.settings?.timezone || DEFAULT_TIMEZONE;
    const day = dayRangeInTz(now, tz);
    if (isWeekendDateStr(day.dateStr)) continue;

    // O resumo só considera turmas cujo turno já fechou a entrada (+60min).
    // Sem esse filtro, o resumo das 8h30 contaria o turno da TARDE inteiro
    // como ausente. Escolas multi-turno: o digest sai quando o primeiro
    // turno fecha, cobrindo apenas as turmas devidas naquele momento.
    const nowMin = localMinutes(now, tz);
    const dueClassIds = school.classes
      .filter((c) => {
        const sched = resolveSchedule(c.shift, school.settings ?? null);
        return sched ? nowMin >= timeToMinutes(sched.entryLimit) + 60 : false;
      })
      .map((c) => c.id);
    if (dueClassIds.length === 0) continue;

    // Idempotência por escola+dia
    const digestKey = `${school.id}:${day.dateStr}`;
    const already = await prisma.auditLog.findFirst({
      where: { action: 'DIGEST_SENT', entityId: digestKey },
      select: { id: true },
    });
    if (already) continue;

    const [students, entries] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId: school.id, isActive: true, classId: { in: dueClassIds } },
        select: { id: true, name: true },
      }),
      prisma.attendanceEvent.findMany({
        where: {
          student: { schoolId: school.id },
          eventType: 'ENTRY',
          timestamp: { gte: day.start, lt: day.end },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
    ]);
    if (students.length === 0 || entries.length === 0) continue; // sem aula hoje

    const presentIds = new Set(entries.map((e) => e.studentId));
    const absentees = students.filter((s) => !presentIds.has(s.id));

    const names = absentees.slice(0, 8).map((s) => s.name.split(' ').slice(0, 2).join(' '));
    const more = absentees.length > 8 ? ` e mais ${absentees.length - 8}` : '';
    const body = absentees.length === 0
      ? `Todos os ${students.length} alunos presentes hoje. 🎉`
      : `${presentIds.size} presentes, ${absentees.length} ausentes: ${names.join(', ')}${more}. Veja a Chamada Diária para contatar os responsáveis.`;

    results.push({ school: school.name, present: presentIds.size, absent: absentees.length, sentTo: school.pushSubscriptions.length });
    if (dryRun) continue;

    let delivered = 0;
    for (const sub of school.pushSubscriptions) {
      const ok = await sendPushToSubscription(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        {
          title: `Porta Segura — Resumo de hoje`,
          body,
          tag: `digest-${day.dateStr}`,
          data: { type: 'digest', url: '/admin/attendance' },
        },
        sub.id
      );
      if (ok) delivered++;
    }

    await prisma.auditLog.create({
      data: {
        action: 'DIGEST_SENT',
        entityType: 'School',
        entityId: digestKey,
        metadata: JSON.stringify({ present: presentIds.size, absent: absentees.length, delivered }),
      },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, dryRun, digests: results });
}
