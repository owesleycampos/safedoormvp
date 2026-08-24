import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import { getSchoolTimezone } from '@/lib/school-tz';
import {
  addDaysStr, dayRangeForDateStr, isWeekendDateStr, localDateStr,
} from '@/lib/timezone';

/**
 * GET /api/reports/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns students with their attendance status for each day in the range.
 * Days are calendar days in the SCHOOL's timezone. Max range: 60 days.
 */
export async function GET(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const schoolId = auth.schoolId;
  const { searchParams } = new URL(req.url);

  const tz = await getSchoolTimezone(schoolId);
  const todayStr = localDateStr(new Date(), tz);

  const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  let toStr = isDate(toParam) ? toParam : todayStr;
  let fromStr = isDate(fromParam) ? fromParam : addDaysStr(toStr, -6);

  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];

  // Clamp range to 60 days
  const dates: string[] = [];
  for (let d = fromStr; d <= toStr && dates.length < 60; d = addDaysStr(d, 1)) {
    dates.push(d);
  }
  fromStr = dates[0];
  toStr = dates[dates.length - 1];

  const rangeStart = dayRangeForDateStr(fromStr, tz).start;
  const rangeEnd = dayRangeForDateStr(toStr, tz).end;

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
        timestamp: { gte: rangeStart, lt: rangeEnd },
      },
      select: {
        studentId: true,
        timestamp: true,
        notes: true,
      },
    }),
  ]);

  // Build a Set of "studentId:YYYY-MM-DD" (school-local day) for O(1) lookup
  const presentSet = new Set<string>();
  const lateSet = new Set<string>();
  for (const ev of events) {
    const day = localDateStr(ev.timestamp, tz);
    presentSet.add(`${ev.studentId}:${day}`);
    if (ev.notes?.includes('ATRASO') || ev.notes?.includes('Atraso')) {
      lateSet.add(`${ev.studentId}:${day}`);
    }
  }

  const rows = students.map((s) => ({
    id: s.id,
    name: s.name,
    className: s.class?.name ?? 'Sem turma',
    attendance: Object.fromEntries(
      dates.map((d) => {
        const key = `${s.id}:${d}`;
        return [
          d,
          isWeekendDateStr(d)
            ? 'weekend'
            : !presentSet.has(key)
            ? 'absent'
            : lateSet.has(key)
            ? 'late'
            : 'present',
        ];
      })
    ),
  }));

  return NextResponse.json({ dates, rows });
}
