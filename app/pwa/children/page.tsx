import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  DEFAULT_TIMEZONE, addDaysStr, dayRangeForDateStr, isWeekendDateStr,
  localDateStr, weekdayOfDateStr,
} from '@/lib/timezone';
import { ChildrenClient } from '@/components/pwa/children-client';

export const metadata = { title: 'Meus Filhos' };

async function getChildren(userId: string) {
  const now = new Date();
  // Janela de busca larga; os recortes reais são feitos por dia LOCAL da
  // escola. Antes o cálculo usava o fuso do servidor (UTC na Vercel) e a
  // semana virava na hora errada.
  const fetchStart = new Date(now.getTime() - 40 * 86400000);

  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      students: {
        include: {
          student: {
            include: {
              class: { select: { name: true } },
              school: { select: { name: true, settings: { select: { timezone: true } } } },
              attendance: {
                where: {
                  timestamp: { gte: fetchStart },
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
    const tz = sp.student.school?.settings?.timezone || DEFAULT_TIMEZONE;
    const todayStr = localDateStr(now, tz);
    const today = dayRangeForDateStr(todayStr, tz);

    const allEvents = sp.student.attendance;
    const todayEvents = allEvents.filter(
      (e) => e.timestamp >= today.start && e.timestamp < today.end
    );

    // Dias com ENTRADA, por dia local da escola
    const attendedDays = new Set(
      allEvents
        .filter((e) => e.eventType === 'ENTRY')
        .map((e) => localDateStr(e.timestamp, tz))
    );

    // Segunda-feira da semana local corrente
    const dow = weekdayOfDateStr(todayStr); // 0=Dom
    const mondayStr = addDaysStr(todayStr, -(dow === 0 ? 6 : dow - 1));

    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    const weeklyAttendance = weekDays.map((label, i) => {
      const dateStr = addDaysStr(mondayStr, i);
      if (dateStr > todayStr) return { label, present: null }; // dia futuro
      return { label, present: attendedDays.has(dateStr) };
    });

    // Percentual da semana. O dia de HOJE só entra na conta depois que a
    // criança chegou — antes, uma mãe abrindo o app às 7h de segunda via
    // "0%" porque o dia em curso já contava como falta.
    const countableDays = weeklyAttendance.filter((d, i) => {
      if (d.present === null) return false;
      const dateStr = addDaysStr(mondayStr, i);
      return !(dateStr === todayStr && d.present === false);
    });
    const presentDays = countableDays.filter((d) => d.present === true).length;
    // null quando a semana ainda não teve nenhum dia contável — mostrar
    // 100% num vazio dava um falso "tudo certo".
    const weeklyPercentage = countableDays.length > 0
      ? Math.round((presentDays / countableDays.length) * 100)
      : null;

    // Mês perfeito: todos os dias úteis do mês local, exceto o de hoje
    // antes da chegada
    const monthPrefix = todayStr.slice(0, 7);
    const schoolDaysThisMonth: string[] = [];
    for (let d = `${monthPrefix}-01`; d <= todayStr; d = addDaysStr(d, 1)) {
      if (isWeekendDateStr(d)) continue;
      if (d === todayStr && !attendedDays.has(d)) continue;
      schoolDaysThisMonth.push(d);
    }
    const perfectMonth =
      schoolDaysThisMonth.length > 0 &&
      schoolDaysThisMonth.every((d) => attendedDays.has(d));

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
