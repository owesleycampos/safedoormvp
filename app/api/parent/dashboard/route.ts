import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/parent/dashboard
 * Returns parent's children with today's attendance and 7-day history.
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
            },
          },
        },
      },
    },
  });

  if (!parent) {
    return NextResponse.json({ children: [] });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const studentIds = parent.students.map((s) => s.student.id);

  // Fetch events for last 7 days
  const events = await prisma.attendanceEvent.findMany({
    where: {
      studentId: { in: studentIds },
      timestamp: { gte: sevenDaysAgo, lt: tomorrow },
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
    const studentEvents = events.filter((e) => e.studentId === s.id);

    // Today's status
    const todayEvents = studentEvents.filter(
      (e) => e.timestamp >= today && e.timestamp < tomorrow
    );
    const entry = todayEvents.find((e) => e.eventType === 'ENTRY');
    const exit = todayEvents.filter((e) => e.eventType === 'EXIT').pop();
    const isLate = entry?.notes?.includes('ATRASO');

    let todayStatus: string;
    if (!entry) todayStatus = 'absent';
    else if (exit) todayStatus = 'left';
    else if (isLate) todayStatus = 'late';
    else todayStatus = 'present';

    // 7-day history
    const weekHistory: { date: string; status: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekHistory.push({ date: dateStr, status: 'weekend' });
        continue;
      }

      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayEntry = studentEvents.find(
        (e) => e.eventType === 'ENTRY' && e.timestamp >= d && e.timestamp < nextDay
      );

      if (!dayEntry) {
        weekHistory.push({ date: dateStr, status: 'absent' });
      } else if (dayEntry.notes?.includes('ATRASO')) {
        weekHistory.push({ date: dateStr, status: 'late' });
      } else {
        weekHistory.push({ date: dateStr, status: 'present' });
      }
    }

    // 30-day frequency
    const weekdays = weekHistory.filter((d) => d.status !== 'weekend');
    const presentCount = weekdays.filter((d) => d.status === 'present' || d.status === 'late').length;
    const frequencyRate = weekdays.length > 0 ? Math.round((presentCount / weekdays.length) * 100) : 100;

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
