import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import { addDaysStr, dayRangeForDateStr, localDateStr, isWeekendDateStr } from '@/lib/timezone';

/**
 * GET /api/students/[id]/history?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a student's full attendance history for their individual timeline page.
 * Defaults to last 30 days if no date range is provided.
 *
 * Response: {
 *   student: { id, name, className, photoUrl, birthDate },
 *   events: AttendanceEvent[],
 *   dailySummary: { date, status, entryTime, exitTime, stayMinutes }[],
 *   stats: { totalDays, presentDays, absentDays, lateDays, avgStayMinutes, frequencyRate }
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Era o único relatório fazendo conta de dia no fuso do SERVIDOR (UTC na
  // Vercel): saída às 21h30 de SP caía no dia seguinte e virava "falta"
  // fantasma. Agora tudo roda no fuso da escola, como os demais relatórios.
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;
  const { schoolId, timezone: tz } = auth;
  const studentId = params.id;

  // ── Validate student belongs to this school ───────────────────
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, isActive: true },
    include: {
      class: { select: { name: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });
  }

  // ── Parse date range (default: last 30 days) ─────────────────
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const todayStr = localDateStr(new Date(), tz);
  const fromStr = isDate(fromParam) ? fromParam : addDaysStr(todayStr, -30);
  const toStr = isDate(toParam) ? toParam : todayStr;

  const fromDate = dayRangeForDateStr(fromStr, tz).start;
  const toDate = dayRangeForDateStr(toStr, tz).end;

  // ── Fetch attendance events ───────────────────────────────────
  const events = await prisma.attendanceEvent.findMany({
    where: {
      studentId,
      timestamp: { gte: fromDate, lte: toDate },
    },
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      timestamp: true,
      eventType: true,
      notes: true,
      isManual: true,
      confidence: true,
      photoUrl: true,
      device: { select: { name: true } },
    },
  });

  // ── Build per-day aggregation ─────────────────────────────────
  // Group events by date string
  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const dateKey = localDateStr(event.timestamp, tz);
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  }

  // DIA LETIVO = dia em que a ESCOLA operou (teve pelo menos uma entrada),
  // não "todo dia útil do intervalo".
  //
  // Esta rota contava férias e feriados como falta: um aluno que compareceu aos
  // 8 dias letivos de julho aparecia com 8/23 = 34,8% e disparava o banner
  // vermelho "risco de reprovação por falta" — e o PDF exportado marcava "F" em
  // 15 colunas. O alerta de infrequência (/api/reports/alerts) e a tela do
  // responsável já usavam a definição correta; as três precisam bater, porque
  // esses números são impressos e entregues a pais e ao Conselho Tutelar.
  const schoolEntries = await prisma.attendanceEvent.findMany({
    where: {
      student: { schoolId },
      eventType: 'ENTRY',
      timestamp: { gte: fromDate, lt: toDate },
    },
    select: { timestamp: true },
  });
  const schoolDays = new Set<string>();
  for (const ev of schoolEntries) {
    const d = localDateStr(ev.timestamp, tz);
    if (!isWeekendDateStr(d)) schoolDays.add(d);
  }

  // Piso na matrícula: o aluno não é cobrado por dias anteriores à entrada dele
  // na escola (mesma regra da tela do responsável e do alerta).
  const enrolledStr = localDateStr(student.createdAt, tz);

  const relevantDays = Array.from(schoolDays)
    .filter((d) => d <= todayStr && d >= enrolledStr)
    .sort();

  type DaySummary = {
    date: string;
    status: 'present' | 'absent' | 'late' | 'early_exit';
    entryTime: string | null;
    exitTime: string | null;
    stayMinutes: number | null;
  };

  const dailySummary: DaySummary[] = [];
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let totalStayMinutes = 0;
  let daysWithStay = 0;

  for (const date of relevantDays) {
    const dayEvents = eventsByDate.get(date) || [];
    const entries = dayEvents.filter((e) => e.eventType === 'ENTRY');
    const exits = dayEvents.filter((e) => e.eventType === 'EXIT');

    if (entries.length === 0) {
      // No entry at all — absent
      dailySummary.push({
        date,
        status: 'absent',
        entryTime: null,
        exitTime: null,
        stayMinutes: null,
      });
      absentDays++;
      continue;
    }

    // Use first entry and last exit
    const firstEntry = entries[0];
    const lastExit = exits.length > 0 ? exits[exits.length - 1] : null;

    // Determine status based on notes
    const hasLateNote = dayEvents.some(
      (e) => e.notes && e.notes.toLowerCase().includes('atraso')
    );
    // A nota gravada é a constante 'SAIDA_ANTECIPADA' (sem acento, com _), mas
    // comparava-se com 'saída antecipada' (com acento e espaço) — nunca casava,
    // então a saída antecipada jamais aparecia no histórico do aluno.
    const hasEarlyExitNote = dayEvents.some(
      (e) => e.notes && e.notes.toLowerCase().includes('antecipada')
    );

    let status: DaySummary['status'] = 'present';
    if (hasLateNote) {
      status = 'late';
      lateDays++;
    } else if (hasEarlyExitNote) {
      status = 'early_exit';
    }
    presentDays++;

    // Calculate stay duration
    let stayMinutes: number | null = null;
    if (lastExit) {
      stayMinutes = Math.round(
        (lastExit.timestamp.getTime() - firstEntry.timestamp.getTime()) / 60000
      );
      if (stayMinutes > 0) {
        totalStayMinutes += stayMinutes;
        daysWithStay++;
      }
    }

    dailySummary.push({
      date,
      status,
      entryTime: firstEntry.timestamp.toISOString(),
      exitTime: lastExit?.timestamp.toISOString() ?? null,
      stayMinutes,
    });
  }

  // ── Overall stats ─────────────────────────────────────────────
  const totalDays = relevantDays.length;
  const avgStayMinutes = daysWithStay > 0 ? Math.round(totalStayMinutes / daysWithStay) : 0;
  const frequencyRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 10000) / 100 : 0;

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      className: student.class.name,
      photoUrl: student.photoUrl,
      birthDate: student.birthDate,
    },
    events,
    dailySummary,
    stats: {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      avgStayMinutes,
      frequencyRate,
    },
  });
}
