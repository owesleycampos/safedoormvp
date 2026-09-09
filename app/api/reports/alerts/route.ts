import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import {
  addDaysStr, dayRangeForDateStr, isWeekendDateStr, localDateStr,
} from '@/lib/timezone';

/**
 * GET /api/reports/alerts?classId=xxx&days=30
 *
 * Frequency alerts report (Alerta de Infrequência — LDB Art. 12).
 * Returns students whose absence rate >= 25% over the given period.
 *
 * Rationality of the denominator:
 *  - Days are calendar days in the SCHOOL's timezone.
 *  - Today is excluded — a day still in progress can't count as a full
 *    absence for students who simply haven't arrived yet.
 *  - A weekday only counts as a SCHOOL day if at least one student of the
 *    school registered an ENTRY that day. Holidays, vacations and strike
 *    days therefore don't inflate anyone's absence rate.
 */
export async function GET(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const schoolId = auth.schoolId;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30', 10)));

  const tz = auth.timezone;
  const todayStr = localDateStr(new Date(), tz);
  const endStr = addDaysStr(todayStr, -1); // exclude the day in progress
  const startStr = addDaysStr(endStr, -(days - 1));

  const rangeStart = dayRangeForDateStr(startStr, tz).start;
  const rangeEnd = dayRangeForDateStr(endStr, tz).end;

  // Get active students (optionally filtered by class)
  const students = await prisma.student.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(classId ? { classId } : {}),
    },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      createdAt: true, // piso da apuração: dia da matrícula
      class: { select: { id: true, name: true } },
    },
  });

  // ALL entry events of the school in the period (not class-filtered):
  // they define which days were actual school days.
  const entryEvents = await prisma.attendanceEvent.findMany({
    where: {
      student: { schoolId, isActive: true },
      eventType: 'ENTRY',
      timestamp: { gte: rangeStart, lt: rangeEnd },
    },
    select: {
      studentId: true,
      timestamp: true,
    },
  });

  // School days = weekdays with at least one entry; presence per student per day
  const schoolDays = new Set<string>();
  const presentDaysMap = new Map<string, Set<string>>();
  for (const ev of entryEvents) {
    const dateKey = localDateStr(ev.timestamp, tz);
    if (isWeekendDateStr(dateKey)) continue;

    schoolDays.add(dateKey);
    if (!presentDaysMap.has(ev.studentId)) {
      presentDaysMap.set(ev.studentId, new Set());
    }
    presentDaysMap.get(ev.studentId)!.add(dateKey);
  }

  const totalSchoolDays = schoolDays.size;
  if (totalSchoolDays === 0) {
    return NextResponse.json({
      days,
      totalWeekdays: 0,
      startDate: startStr,
      endDate: endStr,
      totalStudents: students.length,
      alertCount: 0,
      alerts: [],
    });
  }

  // Calculate absence rate for each student
  const alerts: Array<{
    id: string;
    name: string;
    className: string;
    photoUrl: string | null;
    totalDays: number;
    absentDays: number;
    absenceRate: number;
    status: 'warning' | 'critical';
  }> = [];

  const schoolDayList = Array.from(schoolDays);

  for (const student of students) {
    // PISO NA MATRÍCULA: só contam os dias letivos a partir do dia em que o
    // aluno entrou na escola. Sem isto, uma turma importada por CSV hoje
    // aparecia inteira com 100% de falta e "crítico" no topo da lista — à
    // frente dos alunos que estão de fato em risco. Este alerta é obrigação
    // legal (LDB art. 12) e vai para o Conselho Tutelar; não pode ter ruído.
    const enrolledStr = localDateStr(student.createdAt, tz);
    const daysForStudent = schoolDayList.filter((d) => d >= enrolledStr).length;
    if (daysForStudent === 0) continue; // entrou depois do período: nada a apurar

    const presentSet = presentDaysMap.get(student.id);
    const presentDays = presentSet
      ? Array.from(presentSet).filter((d) => d >= enrolledStr).length
      : 0;
    const absentDays = daysForStudent - presentDays;
    const absenceRate = Math.round((absentDays / daysForStudent) * 10000) / 100; // e.g. 33.33

    if (absenceRate >= 25) {
      alerts.push({
        id: student.id,
        name: student.name,
        className: student.class?.name ?? '',
        photoUrl: student.photoUrl,
        totalDays: daysForStudent,
        absentDays,
        absenceRate,
        status: absenceRate >= 50 ? 'critical' : 'warning',
      });
    }
  }

  // Sort by absenceRate descending (worst first)
  alerts.sort((a, b) => b.absenceRate - a.absenceRate);

  return NextResponse.json({
    days,
    totalWeekdays: totalSchoolDays,
    startDate: startStr,
    endDate: endStr,
    totalStudents: students.length,
    alertCount: alerts.length,
    alerts,
  });
}
