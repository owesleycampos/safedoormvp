import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TimelineClient } from '@/components/pwa/timeline-client';
import { DEFAULT_TIMEZONE, addDaysStr, dayRangeForDateStr, localDateStr } from '@/lib/timezone';

export const metadata = { title: 'Histórico' };

async function getTimeline(userId: string, studentId?: string, fromStr?: string, toStr?: string) {
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

  // Fuso DA ESCOLA para o corte da janela e para o agrupamento por dia no
  // cliente — o corte antigo rodava no fuso do servidor (UTC na Vercel) e
  // derrubava eventos da manhã do dia mais antigo.
  const settings = children[0]
    ? await prisma.schoolSettings.findFirst({
        where: { school: { students: { some: { id: children[0].id } } } },
        select: { timezone: true },
      })
    : null;
  const tz = settings?.timezone || DEFAULT_TIMEZONE;

  const _today = localDateStr(new Date(), tz);
  if (!targetStudentId) return { children, events: [], selectedStudentId: null, tz, from: addDaysStr(_today, -6), to: _today };

  // Verify parent owns this student
  const owns = children.find((c) => c.id === targetStudentId);
  if (!owns) return { children, events: [], selectedStudentId: null, tz, from: addDaysStr(localDateStr(new Date(), tz), -6), to: localDateStr(new Date(), tz) };

  // Período: personalizado (from/to) ou os últimos 7 dias por padrão.
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const todayStr = localDateStr(new Date(), tz);
  const startStr = isDate(fromStr) ? fromStr! : addDaysStr(todayStr, -6);
  const endStr = isDate(toStr) ? toStr! : todayStr;
  const start = dayRangeForDateStr(startStr, tz).start;
  const end = dayRangeForDateStr(endStr, tz).end;

  const events = await prisma.attendanceEvent.findMany({
    where: {
      studentId: targetStudentId,
      timestamp: { gte: start, lt: end },
    },
    include: {
      student: { select: { name: true, photoUrl: true, school: { select: { name: true } } } },
      device: { select: { name: true } },
    },
    orderBy: { timestamp: 'desc' },
  });

  return { children, events, selectedStudentId: targetStudentId, tz, from: startStr, to: endStr };
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: { studentId?: string; from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const { children, events, selectedStudentId, tz, from, to } = await getTimeline(userId, searchParams.studentId, searchParams.from, searchParams.to);

  return (
    <TimelineClient
      children={children}
      events={events}
      selectedStudentId={selectedStudentId}
      tz={tz}
      from={from}
      to={to}
    />
  );
}
