import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/reports/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns students with their attendance status for each day in the range.
 * Max range: 60 days.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { searchParams } = new URL(req.url);

  const fromStr = searchParams.get('from');
  const toStr   = searchParams.get('to');

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const fromDate = fromStr ? new Date(fromStr + 'T00:00:00') : new Date(Date.now() - 6 * 86400000);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = toStr ? new Date(toStr + 'T23:59:59') : today;
  toDate.setHours(23, 59, 59, 999);

  // Clamp range to 60 days
  const maxMs = 60 * 86400000;
  const clampedFrom = toDate.getTime() - fromDate.getTime() > maxMs
    ? new Date(toDate.getTime() - maxMs)
    : fromDate;

  const [students, events] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, isActive: true },
      select: {
        id: true,
        name: true,
        class: { select: { name: true } },
      },
      orderBy: [
        { class: { name: 'asc' } },
        { name: 'asc' },
      ],
    }),
    prisma.attendanceEvent.findMany({
      where: {
        student: { schoolId },
        eventType: 'ENTRY',
        timestamp: { gte: clampedFrom, lte: toDate },
      },
      select: {
        studentId: true,
        timestamp: true,
      },
    }),
  ]);

  // Build a Set of "studentId:YYYY-MM-DD" for O(1) lookup
  const presentSet = new Set<string>();
  for (const ev of events) {
    const day = ev.timestamp.toISOString().slice(0, 10);
    presentSet.add(`${ev.studentId}:${day}`);
  }

  // Generate date array
  const dates: string[] = [];
  const cur = new Date(clampedFrom);
  while (cur <= toDate && dates.length < 60) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  const rows = students.map((s) => ({
    id: s.id,
    name: s.name,
    className: s.class?.name ?? 'Sem turma',
    attendance: Object.fromEntries(
      dates.map((d) => {
        const dayOfWeek = new Date(d + 'T12:00:00').getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        return [d, isWeekend ? 'weekend' : presentSet.has(`${s.id}:${d}`) ? 'present' : 'absent'];
      })
    ),
  }));

  return NextResponse.json({ dates, rows });
}
