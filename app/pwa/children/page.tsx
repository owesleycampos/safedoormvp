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
              school: { select: { id: true, name: true, settings: { select: { timezone: true } } } },
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

  if (!parent) return [];

  // Dias em que a ESCOLA operou (qualquer aluno entrou), por escola. É a mesma
  // definição de "dia letivo" da tela de frequência: usar seg–sex fixo fazia um
  // feriado no meio da semana derrubar o % da semana e tirar a "Presença
  // Exemplar" de uma criança com frequência de fato perfeita.
  const schoolIds = Array.from(new Set(parent.students.map((sp) => sp.student.school?.id).filter(Boolean))) as string[];
  const schoolEntries = schoolIds.length
    ? await prisma.attendanceEvent.findMany({
        where: {
          student: { schoolId: { in: schoolIds } },
          eventType: 'ENTRY',
          timestamp: { gte: fetchStart },
        },
        select: { timestamp: true, student: { select: { schoolId: true } } },
      })
    : [];
  const schoolDaysBySchool = new Map<string, Set<string>>();
  for (const e of schoolEntries) {
    const sid = e.student.schoolId;
    const tzS = parent.students.find((sp) => sp.student.school?.id === sid)?.student.school?.settings?.timezone || DEFAULT_TIMEZONE;
    const set = schoolDaysBySchool.get(sid) || new Set<string>();
    set.add(localDateStr(e.timestamp, tzS));
    schoolDaysBySchool.set(sid, set);
  }

  return parent.students.map((sp) => {
    const tz = sp.student.school?.settings?.timezone || DEFAULT_TIMEZONE;
    const todayStr = localDateStr(now, tz);
    const today = dayRangeForDateStr(todayStr, tz);
    const schoolDays = schoolDaysBySchool.get(sp.student.school?.id || '') || new Set<string>();
    // Um dia é "letivo" para o card se a escola operou nele. Fallback: dia útil
    // (para uma escola nova sem histórico ainda).
    const isSchoolDay = (d: string) => (schoolDays.size > 0 ? schoolDays.has(d) : !isWeekendDateStr(d));

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
      // Dia em que a escola não operou (feriado): neutro, não conta como falta.
      if (!isSchoolDay(dateStr)) return { label, present: null };
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
      if (!isSchoolDay(d)) continue; // dias em que a escola realmente operou
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
  });
}

export default async function ChildrenPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const children = await getChildren(userId);

  return <ChildrenClient children={children} />;
}
