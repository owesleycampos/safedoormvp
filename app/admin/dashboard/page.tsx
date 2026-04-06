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

  const [totalStudents, presentToday, recentEvents, unrecognizedCount, classes] = await Promise.all([
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.attendanceEvent.findMany({
      where: { student: { schoolId }, timestamp: { gte: today, lt: tomorrow }, eventType: 'ENTRY' },
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
  ]);

  return {
    totalStudents,
    presentCount: presentToday.length,
    absentCount: totalStudents - presentToday.length,
    recentEvents,
    unrecognizedCount,
    classes,
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
