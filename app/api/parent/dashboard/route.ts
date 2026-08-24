import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, addDaysStr, dayRangeForDateStr, isWeekendDateStr, localDateStr } from '@/lib/timezone';

/**
 * GET /api/parent/dashboard
 * Returns parent's children with today's attendance and 7-day history.
 * Days are calendar days in each child's SCHOOL timezone.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'PARENT') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const userId = (session.user as any)?.id as string;

  // Find parent record
  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      students: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
              birthDate: true,
              class: { select: { name: true } },
              school: { select: { settings: { select: { timezone: true } } } },
            },
          },
        },
      },
    },
  });

  if (!parent) {
    return NextResponse.json({ children: [] });
  }

  const now = new Date();
  const studentIds = parent.students.map((s) => s.student.id);

  // Widest possible fetch window across timezones: 8 local days ≤ 9 UTC days
  const fetchStart = new Date(now.getTime() - 9 * 86400000);

  const events = await prisma.attendanceEvent.findMany({
    where: {
      studentId: { in: studentIds },
      timestamp: { gte: fetchStart },
    },
    select: {
      studentId: true,
      eventType: true,
      timestamp: true,
      notes: true,
      isManual: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  // Build per-student data
  const children = parent.students.map((link) => {
    const s = link.student;
    const tz = s.school?.settings?.timezone || DEFAULT_TIMEZONE;
    const todayStr = localDateStr(now, tz);
    const today = dayRangeForDateStr(todayStr, tz);
    const studentEvents = events.filter((e) => e.studentId === s.id);

    // Today's status
    const todayEvents = studentEvents.filter(
      (e) => e.timestamp >= today.start && e.timestamp < today.end
    );
    const entry = todayEvents.find((e) => e.eventType === 'ENTRY');
    const exit = todayEvents.filter((e) => e.eventType === 'EXIT').pop();
    const isLate = entry?.notes?.includes('ATRASO');

    let todayStatus: string;
    if (exit) todayStatus = 'left';          // an exit means the child WAS at school today
    else if (!entry) todayStatus = 'absent';
    else if (isLate) todayStatus = 'late';
    else todayStatus = 'present';

    // 7-day history (school-local days, ending today)
    const weekHistory: { date: string; status: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = addDaysStr(todayStr, -i);

      if (isWeekendDateStr(dateStr)) {
        weekHistory.push({ date: dateStr, status: 'weekend' });
        continue;
      }

      const day = dayRangeForDateStr(dateStr, tz);
      const dayEntry = studentEvents.find(
        (e) => e.eventType === 'ENTRY' && e.timestamp >= day.start && e.timestamp < day.end
      );

      if (!dayEntry) {
        weekHistory.push({ date: dateStr, status: 'absent' });
      } else if (dayEntry.notes?.includes('ATRASO')) {
        weekHistory.push({ date: dateStr, status: 'late' });
      } else {
        weekHistory.push({ date: dateStr, status: 'present' });
      }
    }

    // 7-day frequency over COMPLETE weekdays only — today is excluded unless
    // the child already arrived, so a day still in progress never counts as
    // an absence. Late still counts as present.
    const countable = weekHistory.filter(
      (d) => d.status !== 'weekend' && !(d.date === todayStr && d.status === 'absent')
    );
    const presentCount = countable.filter((d) => d.status === 'present' || d.status === 'late').length;
    const frequencyRate = countable.length > 0 ? Math.round((presentCount / countable.length) * 100) : 100;

    return {
      id: s.id,
      name: s.name,
      photoUrl: s.photoUrl,
      className: s.class?.name ?? '',
      relationship: link.relationship,
      today: {
        status: todayStatus,
        entryTime: entry?.timestamp.toISOString() ?? null,
        exitTime: exit?.timestamp.toISOString() ?? null,
        isLate: !!isLate,
      },
      weekHistory,
      frequencyRate,
    };
  });

  return NextResponse.json({
    parentName: parent.name,
    children,
  });
}
