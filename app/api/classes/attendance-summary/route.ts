import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, dayRangeForDateStr, localDateStr } from '@/lib/timezone';

/**
 * GET /api/classes/attendance-summary — { classId: {present, total} } do dia.
 *
 * A página de Turmas puxava o relatório INTEIRO (matriz aluno×dia da escola)
 * só para o "x/y presentes hoje" de cada card. Aqui vai só a contagem por
 * turma, no fuso da escola.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const schoolId = (session.user as any)?.schoolId;
  if (!schoolId) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId }, select: { timezone: true } });
  const tz = settings?.timezone || DEFAULT_TIMEZONE;
  const day = dayRangeForDateStr(localDateStr(new Date(), tz), tz);

  const [students, entries] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, classId: true },
    }),
    prisma.attendanceEvent.findMany({
      where: { student: { schoolId }, eventType: 'ENTRY', timestamp: { gte: day.start, lt: day.end } },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
  ]);

  const present = new Set(entries.map((e) => e.studentId));
  const summary: Record<string, { present: number; total: number }> = {};
  for (const s of students) {
    if (!s.classId) continue;
    const row = summary[s.classId] || (summary[s.classId] = { present: 0, total: 0 });
    row.total++;
    if (present.has(s.id)) row.present++;
  }

  return NextResponse.json({ summary });
}
