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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const studentWhere = { schoolId, isActive: true, ...(classId ? { classId } : {}) };

  // 7-day trend data
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [totalStudents, presentToday, recentEvents, unrecognizedCount, classes, trendEvents, lateEvents] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: today, lt: tomorrow },
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
    // Trend: entries per day for last 7 days
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: sevenDaysAgo, lt: tomorrow },
        eventType: 'ENTRY',
      },
      select: { studentId: true, timestamp: true },
    }),
    // Late arrivals today
    prisma.attendanceEvent.findMany({
      where: {
        student: studentWhere,
        timestamp: { gte: today, lt: tomorrow },
        eventType: 'ENTRY',
        notes: { contains: 'ATRASO' },
      },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
  ]);

  // Build 7-day trend
  const trend: { date: string; present: number; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
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

  // Average stay time today (students who have both entry and exit)
  const todayExits = await prisma.attendanceEvent.findMany({
    where: {
      student: studentWhere,
      timestamp: { gte: today, lt: tomorrow },
      eventType: 'EXIT',
    },
    select: { studentId: true, timestamp: true },
  });

  const todayEntries = new Map(
    trendEvents
      .filter(e => e.timestamp.toISOString().slice(0, 10) === today.toISOString().slice(0, 10))
      .map(e => [e.studentId, e.timestamp])
  );

  let totalMinutes = 0;
  let stayCount = 0;
  for (const exit of todayExits) {
    const entry = todayEntries.get(exit.studentId);
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
    presentCount: presentToday.length,
    absentCount: totalStudents - presentToday.length,
    lateCount: lateEvents.length,
    recentEvents,
    unrecognizedCount,
    classes,
    trend,
    avgStayMinutes: stayCount > 0 ? Math.round(totalMinutes / stayCount) : null,
  });
}
