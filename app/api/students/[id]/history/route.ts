import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
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

  const now = new Date();
  const fromDate = fromParam
    ? new Date(`${fromParam}T00:00:00`)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = toParam
    ? new Date(`${toParam}T23:59:59.999`)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
    const dateKey = event.timestamp.toISOString().slice(0, 10);
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  }

  // Generate all weekdays (Mon-Fri) in range for absent detection
  const allWeekdays: string[] = [];
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) {
      allWeekdays.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Exclude future dates
  const todayStr = now.toISOString().slice(0, 10);
  const relevantDays = allWeekdays.filter((d) => d <= todayStr);

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
    const hasEarlyExitNote = dayEvents.some(
      (e) => e.notes && e.notes.toLowerCase().includes('saída antecipada')
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
