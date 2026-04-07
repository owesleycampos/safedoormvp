import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/reports/alerts?classId=xxx&days=30
 *
 * Frequency alerts report (Alerta de Infrequencia - LDB Art. 12).
 * Returns students whose absence rate >= 25% over the given period.
 * Brazilian law (LDB) requires schools to report students who miss 25%+ of classes.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const days = Math.max(1, parseInt(searchParams.get('days') || '30', 10));

  // Calculate date range
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Count weekdays in the period (Mon-Fri)
  let totalWeekdays = 0;
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
      totalWeekdays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (totalWeekdays === 0) {
    return NextResponse.json({ days, totalWeekdays: 0, alerts: [] });
  }

  // Get active students (optionally filtered by class)
  const students = await prisma.student.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(classId ? { classId } : {}),
    },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      class: { select: { id: true, name: true } },
    },
  });

  // Get all ENTRY events in the period for these students
  // A student is considered present on a day if they have at least one ENTRY event
  const entryEvents = await prisma.attendanceEvent.findMany({
    where: {
      student: { schoolId, isActive: true, ...(classId ? { classId } : {}) },
      eventType: 'ENTRY',
      timestamp: { gte: startDate, lte: endDate },
    },
    select: {
      studentId: true,
      timestamp: true,
    },
  });

  // Build set of present days per student (using date string as key)
  const presentDaysMap = new Map<string, Set<string>>();
  for (const ev of entryEvents) {
    const dateKey = ev.timestamp.toISOString().slice(0, 10);
    // Only count weekdays
    const dow = ev.timestamp.getDay();
    if (dow < 1 || dow > 5) continue;

    if (!presentDaysMap.has(ev.studentId)) {
      presentDaysMap.set(ev.studentId, new Set());
    }
    presentDaysMap.get(ev.studentId)!.add(dateKey);
  }

  // Calculate absence rate for each student
  const alerts: Array<{
    id: string;
    name: string;
    className: string;
    photoUrl: string | null;
    totalDays: number;
    absentDays: number;
    absenceRate: number;
    status: 'warning' | 'critical';
  }> = [];

  for (const student of students) {
    const presentDays = presentDaysMap.get(student.id)?.size ?? 0;
    const absentDays = totalWeekdays - presentDays;
    const absenceRate = Math.round((absentDays / totalWeekdays) * 10000) / 100; // e.g. 33.33

    if (absenceRate >= 25) {
      alerts.push({
        id: student.id,
        name: student.name,
        className: student.class?.name ?? '',
        photoUrl: student.photoUrl,
        totalDays: totalWeekdays,
        absentDays,
        absenceRate,
        status: absenceRate >= 50 ? 'critical' : 'warning',
      });
    }
  }

  // Sort by absenceRate descending (worst first)
  alerts.sort((a, b) => b.absenceRate - a.absenceRate);

  return NextResponse.json({
    days,
    totalWeekdays,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    totalStudents: students.length,
    alertCount: alerts.length,
    alerts,
  });
}
