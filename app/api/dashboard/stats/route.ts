import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/dashboard/stats?classId=xxx
 * Returns live dashboard data for client-side polling.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId') || undefined;
  const periodParam = searchParams.get('period') || 'today'; // today | 7d | 30d | custom
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Determine date range for stats
  let rangeStart = new Date(today);
  let rangeEnd = new Date(tomorrow);

  if (periodParam === '7d') {
    rangeStart.setDate(rangeStart.getDate() - 6);
  } else if (periodParam === '30d') {
    rangeStart.setDate(rangeStart.getDate() - 29);
  } else if (periodParam === 'custom' && fromParam && toParam) {
    rangeStart = new Date(fromParam + 'T00:00:00');
    rangeEnd = new Date(toParam + 'T00:00:00');
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  }
  // for 'today', rangeStart = today, rangeEnd = tomorrow (default)

  const studentWhere = { schoolId, isActive: true, ...(classId ? { classId } : {}) };

  // Trend data (always relative to range)
  const trendStart = periodParam === 'today' ? (() => { const d = new Date(today); d.setDate(d.getDate() - 6); return d; })() : new Date(rangeStart);

  const [totalStudents, presentInRange, recentEvents, unrecognizedCount, classes, trendEvents, lateEvents] = await Promise.all([
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
      where: { student: studentWhere },
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
    // Trend: entries per day for range
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: trendStart, lt: rangeEnd },
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

  // Build trend (day by day from trendStart to rangeEnd-1)
  const trend: { date: string; present: number; total: number }[] = [];
  const trendEndDate = new Date(rangeEnd);
  trendEndDate.setDate(trendEndDate.getDate() - 1);
  const numDays = Math.round((trendEndDate.getTime() - trendStart.getTime()) / 86400000) + 1;
  for (let i = 0; i < numDays; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      trend.push({ date: dateStr, present: 0, total: 0 });
      continue;
    }
    const uniqueStudents = new Set(
      trendEvents
        .filter(e => e.timestamp.toISOString().slice(0, 10) === dateStr)
        .map(e => e.studentId)
    );
    trend.push({ date: dateStr, present: uniqueStudents.size, total: totalStudents });
  }

  // Average stay time in range (students who have both entry and exit)
  const rangeExits = await prisma.attendanceEvent.findMany({
    where: {
      student: studentWhere,
      timestamp: { gte: rangeStart, lt: rangeEnd },
      eventType: 'EXIT',
    },
    select: { studentId: true, timestamp: true },
  });

  const entryMap = new Map(
    trendEvents
      .filter(e => e.timestamp >= rangeStart && e.timestamp < rangeEnd)
      .map(e => [e.studentId + '_' + e.timestamp.toISOString().slice(0, 10), e.timestamp])
  );

  let totalMinutes = 0;
  let stayCount = 0;
  for (const exit of rangeExits) {
    const key = exit.studentId + '_' + exit.timestamp.toISOString().slice(0, 10);
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
