/**
 * GET /api/cron/absence-alerts — o alerta que importa: "ainda não chegou".
 *
 * O sistema sempre avisou quando o aluno CHEGA. O aviso de maior valor é o
 * inverso: passado o limite de entrada do turno (+ tolerância), o responsável
 * de quem NÃO chegou recebe "Fulano ainda não chegou à escola". É segurança
 * real — a criança saiu de casa e não entrou no portão.
 *
 * Idempotente: AbsenceAlert tem unique (studentId, dayKey), então o cron pode
 * rodar a cada 10-15 min o dia todo sem duplicar avisos. Cada execução só
 * dispara para turnos cujo limite+tolerância já passou no fuso da ESCOLA.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (padrão dos crons da Vercel) ou
 * header x-cron-secret. ?dryRun=1 responde os candidatos sem enviar nem
 * gravar — usado pela suíte de testes e para conferência manual.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { resolveSchedule, timeToMinutes } from '@/lib/attendance-rules';
import { DEFAULT_TIMEZONE, dayRangeInTz, isWeekendDateStr, localMinutes } from '@/lib/timezone';
import { notifyGuardians } from '@/lib/notify';

/** Minutos após o limite de atraso antes de alarmar — dá tempo do trânsito. */
const TOLERANCE_MIN = 45;

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
    },
  });

  const candidates: Array<{ studentId: string; name: string; school: string; dayKey: string }> = [];
  let sent = 0;

  for (const school of schools) {
    const tz = school.settings?.timezone || DEFAULT_TIMEZONE;
    const day = dayRangeInTz(now, tz);
    if (isWeekendDateStr(day.dateStr)) continue;
    const nowMin = localMinutes(now, tz);

    // Turmas cujo turno já passou do limite + tolerância, AGRUPADAS por turno.
    // O gate de "o turno funcionou hoje" precisa ser POR TURNO: senão, num dia
    // em que só a manhã teve aula, as entradas da manhã satisfaziam um gate de
    // escola inteira e todo aluno da tarde recebia falso "ainda não chegou".
    const dueByShift = new Map<string, string[]>();
    for (const c of school.classes) {
      const schedule = resolveSchedule(c.shift, school.settings ?? null);
      if (!schedule) continue;
      if (nowMin < timeToMinutes(schedule.entryLimit) + TOLERANCE_MIN) continue;
      const key = c.shift || 'GERAL';
      const arr = dueByShift.get(key) || [];
      arr.push(c.id);
      dueByShift.set(key, arr);
    }
    if (dueByShift.size === 0) continue;

    // Só os turnos que de fato operaram hoje (pelo menos uma entrada no turno).
    const dueClassIds: string[] = [];
    for (const [, classIds] of Array.from(dueByShift.entries())) {
      const anyEntry = await prisma.attendanceEvent.findFirst({
        where: {
          student: { schoolId: school.id, classId: { in: classIds } },
          eventType: 'ENTRY',
          timestamp: { gte: day.start, lt: day.end },
        },
        select: { id: true },
      });
      if (anyEntry) dueClassIds.push(...classIds);
    }
    if (dueClassIds.length === 0) continue;

    const absent = await prisma.student.findMany({
      where: {
        schoolId: school.id,
        classId: { in: dueClassIds },
        isActive: true,
        attendance: {
          none: { eventType: 'ENTRY', timestamp: { gte: day.start, lt: day.end } },
        },
        // só quem tem responsável para receber o aviso
        parents: { some: {} },
      },
      select: { id: true, name: true },
    });

    for (const s of absent) {
      candidates.push({ studentId: s.id, name: s.name, school: school.name, dayKey: day.dateStr });
      if (dryRun) continue;

      try {
        // A unique (studentId, dayKey) é o cadeado: quem perder a corrida
        // entre execuções paralelas cai no P2002 e não envia de novo.
        await prisma.absenceAlert.create({
          data: { studentId: s.id, dayKey: day.dateStr },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }

      const firstName = s.name.split(' ')[0];
      const { channels } = await notifyGuardians(s.id, {
        title: 'Porta Segura — Aviso de ausência',
        body: `${firstName} ainda não chegou à ${school.name}. Se estiver tudo bem, ignore este aviso; caso contrário, entre em contato com a escola.`,
        tag: `absence-${day.dateStr}`,
        requireInteraction: true,
        data: { type: 'absence', studentId: s.id },
      });
      // Mantém a trava sempre (idempotência: não re-alerta amanhã nem em
      // execução paralela) e registra os canais entregues. channels vazio
      // fica gravado como 'não entregue' — sem apagar a trava, para não
      // re-tentar em loop quando o responsável simplesmente não tem push.
      await prisma.absenceAlert.update({
        where: { studentId_dayKey: { studentId: s.id, dayKey: day.dateStr } },
        data: { channels: channels.join(',') || null },
      }).catch(() => {});
      sent++;
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    schoolsChecked: schools.length,
    candidates: dryRun ? candidates : candidates.length,
    sent,
  });
}
