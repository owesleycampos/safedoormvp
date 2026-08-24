import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import { getSchoolTimezone } from '@/lib/school-tz';
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

  const tz = await getSchoolTimezone(schoolId);
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

  // Trend window — independent from the KPI period, ends at the KPI end
  const trendDays = trendDaysParam ? parseInt(trendDaysParam, 10) : 7;
  const trendStartStr = addDaysStr(rangeEndStr, -(trendDays - 1));
  const trendStart = dayRangeForDateStr(trendStartStr, tz).start;
  // Entry-event fetch must cover BOTH the trend window and the KPI range so
  // avg-stay pairing never misses entries outside the trend window.
  const entryFetchStart = trendStart < rangeStart ? trendStart : rangeStart;

  const [totalStudents, presentInRange, recentEvents, unrecognizedCount, classes, entryEvents, lateEvents] = await Promise.all([
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
      include: {
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
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Entries covering trend window + KPI range (for trend AND avg-stay)
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: entryFetchStart, lt: rangeEnd },
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
  ]);

  // Build trend (day by day, school-local days)
  const trend: { date: string; present: number; total: number }[] = [];
  const entriesByDay = new Map<string, Set<string>>();
  for (const e of entryEvents) {
    const day = localDateStr(e.timestamp, tz);
    if (!entriesByDay.has(day)) entriesByDay.set(day, new Set());
    entriesByDay.get(day)!.add(e.studentId);
  }
  for (let d = trendStartStr; d <= rangeEndStr; d = addDaysStr(d, 1)) {
    if (isWeekendDateStr(d)) {
      trend.push({ date: d, present: 0, total: 0 });
      continue;
    }
    trend.push({ date: d, present: entriesByDay.get(d)?.size ?? 0, total: totalStudents });
  }

  // Average stay time in range (students who have both entry and exit that day)
  const rangeExits = await prisma.attendanceEvent.findMany({
    where: {
      student: studentWhere,
      timestamp: { gte: rangeStart, lt: rangeEnd },
      eventType: 'EXIT',
    },
    select: { studentId: true, timestamp: true },
  });

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
    classes,
    trend,
    avgStayMinutes: stayCount > 0 ? Math.round(totalMinutes / stayCount) : null,
    period: periodParam,
  });
}
