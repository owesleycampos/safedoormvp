import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ChildrenClient } from '@/components/pwa/children-client';

export const metadata = { title: 'Meus Filhos' };

async function getChildren(userId: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Calculate the start of the current week (Monday)
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  // Start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      students: {
        include: {
          student: {
            include: {
              class: { select: { name: true } },
              school: { select: { name: true } },
              attendance: {
                where: {
                  timestamp: { gte: monthStart },
                },
                orderBy: { timestamp: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  return parent?.students.map((sp) => {
    const allEvents = sp.student.attendance;
    const todayEvents = allEvents.filter(
      (e) => new Date(e.timestamp) >= todayStart
    );

    // Build weekly attendance: for each weekday (Mon-Fri), check if there was an ENTRY event
    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    const weeklyAttendance = weekDays.map((label, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const dayEnd = new Date(dayDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Only count days up to today
      if (dayDate > now) return { label, present: null }; // future day

      const hasEntry = allEvents.some(
        (e) =>
          e.eventType === 'ENTRY' &&
          new Date(e.timestamp) >= dayDate &&
          new Date(e.timestamp) < dayEnd
      );
      return { label, present: hasEntry };
    });

    // Weekly percentage (only counting past/current days)
    const countableDays = weeklyAttendance.filter((d) => d.present !== null);
    const presentDays = countableDays.filter((d) => d.present === true).length;
    const weeklyPercentage = countableDays.length > 0
      ? Math.round((presentDays / countableDays.length) * 100)
      : 0;

    // Monthly perfect attendance check
    const monthEvents = allEvents.filter(
      (e) => e.eventType === 'ENTRY' && new Date(e.timestamp) >= monthStart
    );
    // Count unique school days this month (Mon-Fri, up to today)
    const schoolDaysThisMonth: Set<string> = new Set();
    const cursor = new Date(monthStart);
    while (cursor <= now) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) {
        schoolDaysThisMonth.add(cursor.toISOString().slice(0, 10));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    // Count unique days with ENTRY events
    const attendedDays = new Set(
      monthEvents.map((e) => new Date(e.timestamp).toISOString().slice(0, 10))
    );
    const perfectMonth =
      schoolDaysThisMonth.size > 0 &&
      Array.from(schoolDaysThisMonth).every((d) => attendedDays.has(d));

    return {
      ...sp.student,
      relationship: sp.relationship,
      lastEvent: todayEvents[0] || null,
      weeklyAttendance,
      weeklyPercentage,
      perfectMonth,
    };
  }) || [];
}

export default async function ChildrenPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const children = await getChildren(userId);

  return <ChildrenClient children={children} />;
}
