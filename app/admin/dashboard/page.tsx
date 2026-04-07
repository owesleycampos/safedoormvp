import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DashboardClient } from '@/components/admin/dashboard-client';

export const metadata = { title: 'Dashboard' };

async function getDashboardData(schoolId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const studentWhere = { schoolId, isActive: true };

  const [totalStudents, presentToday, recentEvents, unrecognizedCount, classes, trendEvents, lateEvents] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.attendanceEvent.findMany({
      where: { student: studentWhere, timestamp: { gte: today, lt: tomorrow }, eventType: 'ENTRY' },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
    prisma.attendanceEvent.findMany({
      where: { student: { schoolId } },
      include: {
        student: { select: { name: true, class: { select: { name: true } }, photoUrl: true } },
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
    prisma.attendanceEvent.findMany({
      where: { student: studentWhere, timestamp: { gte: sevenDaysAgo, lt: tomorrow }, eventType: 'ENTRY' },
      select: { studentId: true, timestamp: true },
    }),
    prisma.attendanceEvent.findMany({
      where: { student: studentWhere, timestamp: { gte: today, lt: tomorrow }, eventType: 'ENTRY', notes: { contains: 'ATRASO' } },
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
        .filter((e: any) => e.timestamp.toISOString().slice(0, 10) === dateStr)
        .map((e: any) => e.studentId)
    );
    trend.push({ date: dateStr, present: uniqueStudents.size, total: totalStudents });
  }

  return {
    totalStudents,
    presentCount: presentToday.length,
    absentCount: totalStudents - presentToday.length,
    lateCount: lateEvents.length,
    recentEvents,
    unrecognizedCount,
    classes,
    trend,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const schoolId = (session?.user as any)?.schoolId;

  const data = await getDashboardData(schoolId);

  return (
    <div className="flex flex-col flex-1 page-enter">
      <DashboardClient data={data} />
    </div>
  );
}
