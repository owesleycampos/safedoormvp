import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, dayRangeForDateStr, localDateStr } from '@/lib/timezone';

/**
 * GET /api/parent/frequency?studentId= — média de frequência do filho por
 * BIMESTRE, SEMESTRE e ANO letivo.
 *
 * DIA LETIVO = dia em que a ESCOLA operou de fato (pelo menos um aluno
 * registrou entrada naquele dia). Isso substitui "todo dia útil": sem uma
 * agenda acadêmica cadastrada, contar seg-sex incluía janeiro, férias e
 * feriados como letivos — o que afundava a % e disparava alarme falso de
 * 75%. Contar só os dias em que a escola realmente funcionou dá a taxa
 * correta sem depender de calendário, e casa com a experiência do pai.
 *
 * Frequência = dias letivos em que o ALUNO entrou ÷ dias letivos da escola,
 * no período, até hoje.
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
      student: { select: { id: true, schoolId: true, createdAt: true, school: { select: { settings: { select: { timezone: true } } } } } },
    },
  });
  if (!link) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  const schoolId = link.student.schoolId;
  const tz = link.student.school?.settings?.timezone || DEFAULT_TIMEZONE;
  // Piso da frequência = dia da matrícula. Um aluno que entrou em agosto não
  // pode ser contado como ausente em jan–jul (dias em que nem existia na
  // escola) — sem isso a taxa do ano/semestre despencava e disparava o
  // alarme falso de <75% da LDB.
  const enrolledStr = localDateStr(link.student.createdAt, tz);
  const todayStr = localDateStr(new Date(), tz);
  const [y, m] = todayStr.split('-').map(Number);

  const bStartMonth = m - ((m - 1) % 2); // bimestre do calendário: jan-fev, mar-abr, ...
  const bimStart = `${y}-${String(bStartMonth).padStart(2, '0')}-01`;
  const semStart = m <= 6 ? `${y}-01-01` : `${y}-07-01`;
  const yearStart = `${y}-01-01`;

  // UMA consulta cobrindo o ANO (que contém bimestre e semestre): entradas
  // da escola inteira. Dela saem os dias letivos (dias com entrada) E os
  // dias em que ESTE aluno entrou — sem 3 varreduras separadas.
  const yearRange = dayRangeForDateStr(yearStart, tz);
  const todayRange = dayRangeForDateStr(todayStr, tz);
  const entries = await prisma.attendanceEvent.findMany({
    where: {
      student: { schoolId },
      eventType: 'ENTRY',
      timestamp: { gte: yearRange.start, lt: todayRange.end },
    },
    select: { studentId: true, timestamp: true },
  });

  // Dia letivo → conjunto de dias (YYYY-MM-DD) em que a escola operou.
  const schoolDays = new Set<string>();
  const studentDays = new Set<string>();
  for (const e of entries) {
    const d = localDateStr(e.timestamp, tz);
    schoolDays.add(d);
    if (e.studentId === sid) studentDays.add(d);
  }

  function periodStats(startStr: string) {
    // O início efetivo do período nunca é anterior à matrícula do aluno.
    const effStart = startStr < enrolledStr ? enrolledStr : startStr;
    let total = 0;
    let present = 0;
    schoolDays.forEach((d) => {
      if (d < effStart || d > todayStr) return;
      total++;
      if (studentDays.has(d)) present++;
    });
    return {
      rate: total > 0 ? Math.round((present / total) * 1000) / 10 : null,
      present,
      schoolDays: total,
    };
  }

  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return NextResponse.json({
    bimester: { ...periodStats(bimStart), label: `${monthNames[bStartMonth - 1]}–${monthNames[bStartMonth]} de ${y}` },
    semester: { ...periodStats(semStart), label: m <= 6 ? `1º semestre ${y}` : `2º semestre ${y}` },
    year: { ...periodStats(yearStart), label: `Ano de ${y}` },
  });
}
