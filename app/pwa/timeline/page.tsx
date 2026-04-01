import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TimelineClient } from '@/components/pwa/timeline-client';

export const metadata = { title: 'Timeline' };

async function getTimeline(userId: string, studentId?: string) {
  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      students: {
        include: {
          student: {
            select: { id: true, name: true, photoUrl: true, class: { select: { name: true } } },
          },
        },
      },
    },
  });

  const children = parent?.students.map((sp) => sp.student) || [];
  const targetStudentId = studentId || children[0]?.id;

  if (!targetStudentId) return { children, events: [], selectedStudentId: null };

  // Verify parent owns this student
  const owns = children.find((c) => c.id === targetStudentId);
  if (!owns) return { children, events: [], selectedStudentId: null };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const events = await prisma.attendanceEvent.findMany({
    where: {
      studentId: targetStudentId,
      timestamp: { gte: sevenDaysAgo },
    },
    include: {
      student: { select: { name: true, photoUrl: true, school: { select: { name: true } } } },
      device: { select: { name: true } },
    },
    orderBy: { timestamp: 'desc' },
  });

  return { children, events, selectedStudentId: targetStudentId };
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: { studentId?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const { children, events, selectedStudentId } = await getTimeline(userId, searchParams.studentId);

  return (
    <TimelineClient
      children={children}
      events={events}
      selectedStudentId={selectedStudentId}
    />
  );
}
