import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, addDaysStr, dayRangeForDateStr, localDateStr, isWeekendDateStr } from '@/lib/timezone';

/**
 * GET /api/parent/frequency?studentId= — média de frequência do filho por
 * BIMESTRE, SEMESTRE e ANO letivo, para o responsável ter o dado detalhado
 * que a escola já vê nos relatórios.
 *
 * Frequência = dias com entrada registrada ÷ dias letivos (seg-sex) do
 * período, até hoje. Mesma regra de dias úteis do relatório da escola.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'PARENT') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const userId = (session.user as any)?.id as string;
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId obrigatório.' }, { status: 400 });
  const sid: string = studentId;

  // O responsável precisa estar vinculado a este aluno.
  const link = await prisma.studentParent.findFirst({
    where: { studentId: sid, parent: { userId } },
    select: {
      student: { select: { id: true, schoolId: true, school: { select: { settings: { select: { timezone: true } } } } } },
    },
  });
  if (!link) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  const tz = link.student.school?.settings?.timezone || DEFAULT_TIMEZONE;
  const todayStr = localDateStr(new Date(), tz);
  const [y, m] = todayStr.split('-').map(Number);

  // Bimestre corrente alinhado ao calendário (Jan-Fev, Mar-Abr, ...).
  const bStartMonth = m - ((m - 1) % 2); // 1,3,5,7,9,11
  const bimStart = `${y}-${String(bStartMonth).padStart(2, '0')}-01`;
  // Semestre corrente (Jan-Jun ou Jul-Dez).
  const semStart = m <= 6 ? `${y}-01-01` : `${y}-07-01`;
  // Ano letivo: ano civil corrente.
  const yearStart = `${y}-01-01`;

  async function frequencyFrom(startStr: string) {
    const start = dayRangeForDateStr(startStr, tz).start;
    const end = dayRangeForDateStr(todayStr, tz).end;

    const entries = await prisma.attendanceEvent.findMany({
      where: { studentId: sid, eventType: 'ENTRY', timestamp: { gte: start, lt: end } },
      select: { timestamp: true },
    });
    const daysPresent = new Set(entries.map((e) => localDateStr(e.timestamp, tz)));

    let schoolDays = 0;
    for (let d = startStr; d <= todayStr; d = addDaysStr(d, 1)) {
      if (!isWeekendDateStr(d)) schoolDays++;
    }
    const present = daysPresent.size;
    return {
      rate: schoolDays > 0 ? Math.round((present / schoolDays) * 1000) / 10 : 0,
      present,
      schoolDays,
    };
  }

  const [bimester, semester, year] = await Promise.all([
    frequencyFrom(bimStart),
    frequencyFrom(semStart),
    frequencyFrom(yearStart),
  ]);

  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return NextResponse.json({
    bimester: { ...bimester, label: `${monthNames[bStartMonth - 1]}–${monthNames[bStartMonth]} de ${y}` },
    semester: { ...semester, label: m <= 6 ? `1º semestre ${y}` : `2º semestre ${y}` },
    year: { ...year, label: `Ano de ${y}` },
  });
}
