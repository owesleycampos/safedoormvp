import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import {
  addDaysStr, dayRangeForDateStr, isWeekendDateStr, localDateStr,
} from '@/lib/timezone';

/**
 * GET /api/dashboard/stats?classId=xxx
 * Returns live dashboard data for client-side polling.
 * All day boundaries are in the SCHOOL's timezone.
 */
export async function GET(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const schoolId = auth.schoolId;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId') || undefined;
  const periodParam = searchParams.get('period') || 'today'; // today | 7d | 30d | custom
  const trendDaysParam = searchParams.get('trendDays'); // 7 | 30 (independent from period)
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const tz = auth.timezone;
  const todayStr = localDateStr(new Date(), tz);
  const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

  // KPI date range — always today when period=today
  let rangeStartStr = todayStr;
  let rangeEndStr = todayStr; // inclusive

  if (periodParam === '7d') {
    rangeStartStr = addDaysStr(todayStr, -6);
  } else if (periodParam === '30d') {
    rangeStartStr = addDaysStr(todayStr, -29);
  } else if (periodParam === 'custom' && isDate(fromParam) && isDate(toParam)) {
    rangeStartStr = fromParam;
    rangeEndStr = toParam;
    if (rangeStartStr > rangeEndStr) [rangeStartStr, rangeEndStr] = [rangeEndStr, rangeStartStr];
  }

  const rangeStart = dayRangeForDateStr(rangeStartStr, tz).start;
  const rangeEnd = dayRangeForDateStr(rangeEndStr, tz).end;

  const studentWhere = { schoolId, isActive: true, ...(classId ? { classId } : {}) };

  // Trend window — independent from the KPI period. Período personalizado
  // (calendário) manda trendFrom/trendTo; senão cai nos presets em dias.
  const trendFromParam = searchParams.get('trendFrom');
  const trendToParam = searchParams.get('trendTo');
  const trendDays = trendDaysParam ? parseInt(trendDaysParam, 10) : 7;
  const trendEndStr = isDate(trendToParam) ? trendToParam : rangeEndStr;
  const trendStartStr = isDate(trendFromParam)
    ? trendFromParam
    : addDaysStr(trendEndStr, -(trendDays - 1));
  const trendStart = dayRangeForDateStr(trendStartStr, tz).start;
  // Entry-event fetch must cover BOTH the trend window and the KPI range so
  // avg-stay pairing never misses entries outside the trend window.
  const trendEnd = dayRangeForDateStr(trendEndStr, tz).end;
  const entryFetchStart = trendStart < rangeStart ? trendStart : rangeStart;
  const entryFetchEnd = trendEnd > rangeEnd ? trendEnd : rangeEnd;

  // Disparada junto do Promise.all: era a única consulta serial da rota e
  // adicionava uma viagem inteira ao banco no endpoint mais consultado.
  const rangeExitsPromise = prisma.attendanceEvent.findMany({
    where: {
      student: studentWhere,
      timestamp: { gte: rangeStart, lt: rangeEnd },
      eventType: 'EXIT',
    },
    select: { studentId: true, timestamp: true },
  });

  const [totalStudents, presentInRange, recentEvents, unrecognizedCount, offlineDevices, classes, entryEvents, lateEvents, studentEnrollments] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: rangeStart, lt: rangeEnd },
        eventType: 'ENTRY',
      },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: rangeStart, lt: rangeEnd },
      },
      select: {
        id: true,
        eventType: true,
        timestamp: true,
        photoUrl: true,
        student: {
          select: {
            name: true,
            photoUrl: true,
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    }),
    prisma.unrecognizedFaceLog.count({ where: { schoolId, reviewed: false } }),
    // "Offline" = aparelho que JÁ esteve online e parou de responder (aí sim é
    // "verifique energia e internet"). Um device recém-cadastrado nasce OFFLINE
    // com lastSeen nulo e nunca fica online quando a escola usa a câmera do
    // NAVEGADOR (só o agente de mesa marca ONLINE) — isso disparava um alerta
    // vermelho, todos os dias, impossível de limpar, enquanto o sistema
    // registrava presenças normalmente. Alarme que não se apaga é alarme que se
    // aprende a ignorar.
    prisma.device.count({ where: { schoolId, status: 'OFFLINE', lastSeen: { not: null } } }),
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Entries covering trend window + KPI range (for trend AND avg-stay)
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: entryFetchStart, lt: entryFetchEnd },
        eventType: 'ENTRY',
      },
      select: { studentId: true, timestamp: true },
    }),
    // Late arrivals in range
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: rangeStart, lt: rangeEnd },
        eventType: 'ENTRY',
        notes: { contains: 'ATRASO' },
      },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
    // Datas de matrícula: denominador correto de cada dia do gráfico.
    prisma.student.findMany({ where: studentWhere, select: { createdAt: true } }),
  ]);

  // Build trend (day by day, school-local days)
  const trend: { date: string; present: number; total: number }[] = [];
  const entriesByDay = new Map<string, Set<string>>();
  for (const e of entryEvents) {
    const day = localDateStr(e.timestamp, tz);
    if (!entriesByDay.has(day)) entriesByDay.set(day, new Set());
    entriesByDay.get(day)!.add(e.studentId);
  }
  // Denominador POR DIA: quantos alunos já estavam matriculados naquele dia.
  // Usar `totalStudents` (o total de HOJE) media o passado com a régua do
  // presente: a escola tinha 200 alunos, matriculou 60 no dia 20, e todos os
  // dias anteriores passavam a ser lidos como 200/260 = 77% — um dia de
  // presença perfeita aparecia como queda. A "Média %" herdava o mesmo erro.
  const enrolledDates = studentEnrollments
    .map((st) => localDateStr(st.createdAt, tz))
    .sort();
  const enrolledUpTo = (day: string) => {
    // conta quantas matrículas são <= day (lista já ordenada)
    let lo = 0, hi = enrolledDates.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (enrolledDates[mid] <= day) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  for (let d = trendStartStr; d <= trendEndStr; d = addDaysStr(d, 1)) {
    if (isWeekendDateStr(d)) {
      trend.push({ date: d, present: 0, total: 0 });
      continue;
    }
    trend.push({ date: d, present: entriesByDay.get(d)?.size ?? 0, total: enrolledUpTo(d) });
  }

  // Average stay time in range (students who have both entry and exit that day)
  const rangeExits = await rangeExitsPromise;

  const entryMap = new Map<string, Date>();
  for (const e of entryEvents) {
    if (e.timestamp >= rangeStart && e.timestamp < rangeEnd) {
      const key = e.studentId + '_' + localDateStr(e.timestamp, tz);
      const existing = entryMap.get(key);
      if (!existing || e.timestamp < existing) entryMap.set(key, e.timestamp); // first entry of the day
    }
  }

  let totalMinutes = 0;
  let stayCount = 0;
  for (const exit of rangeExits) {
    const key = exit.studentId + '_' + localDateStr(exit.timestamp, tz);
    const entry = entryMap.get(key);
    if (entry) {
      const diff = (exit.timestamp.getTime() - entry.getTime()) / 60000;
      if (diff > 0 && diff < 1440) {
        totalMinutes += diff;
        stayCount++;
      }
    }
  }

  return NextResponse.json({
    totalStudents,
    presentCount: presentInRange.length,
    absentCount: totalStudents - presentInRange.length,
    lateCount: lateEvents.length,
    recentEvents,
    unrecognizedCount,
    offlineDevices,
    classes,
    trend,
    avgStayMinutes: stayCount > 0 ? Math.round(totalMinutes / stayCount) : null,
    period: periodParam,
  });
}
