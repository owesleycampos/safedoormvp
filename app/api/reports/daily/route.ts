import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/reports/daily?date=YYYY-MM-DD&classId=xxx
 *
 * Daily attendance report for teachers.
 * Returns all students in a class with entry/exit times, or absent status.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');
  const classId = searchParams.get('classId');

  // Default to today
  const date = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  date.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Get students (optionally filtered by class)
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
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
  });

  // Get all events for the day
  const events = await prisma.attendanceEvent.findMany({
    where: {
      student: { schoolId, ...(classId ? { classId } : {}) },
      timestamp: { gte: date, lt: dayEnd },
    },
    select: {
      id: true,
      studentId: true,
      eventType: true,
      timestamp: true,
      isManual: true,
      confidence: true,
      notes: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  // Build lookup: studentId → { entry, exit }
  const eventMap = new Map<string, {
    entry: Date | null;
    entryManual: boolean;
    entryEventId: string | null;
    entryNotes: string | null;
    exit: Date | null;
    exitManual: boolean;
    exitEventId: string | null;
    exitNotes: string | null;
    confidence: number | null;
  }>();

  for (const ev of events) {
    if (!eventMap.has(ev.studentId)) {
      eventMap.set(ev.studentId, {
        entry: null, entryManual: false, entryEventId: null, entryNotes: null,
        exit: null, exitManual: false, exitEventId: null, exitNotes: null,
        confidence: null,
      });
    }
    const record = eventMap.get(ev.studentId)!;
    if (ev.eventType === 'ENTRY' && !record.entry) {
      record.entry = ev.timestamp;
      record.entryManual = ev.isManual;
      record.entryEventId = ev.id;
      record.entryNotes = ev.notes;
      record.confidence = ev.confidence;
    }
    if (ev.eventType === 'EXIT') {
      // Take the latest exit
      record.exit = ev.timestamp;
      record.exitManual = ev.isManual;
      record.exitEventId = ev.id;
      record.exitNotes = ev.notes;
    }
  }

  const rows = students.map((s) => {
    const ev = eventMap.get(s.id);
    let status: 'present' | 'absent' | 'left' | 'entry_only';
    if (!ev || !ev.entry) {
      status = 'absent';
    } else if (ev.entry && ev.exit) {
      status = 'left';
    } else {
      status = 'entry_only';
    }

    return {
      id: s.id,
      name: s.name,
      photoUrl: s.photoUrl,
      className: s.class?.name ?? '',
      classId: s.class?.id ?? '',
      status,
      entryTime: ev?.entry?.toISOString() ?? null,
      entryManual: ev?.entryManual ?? false,
      entryEventId: ev?.entryEventId ?? null,
      entryNotes: ev?.entryNotes ?? null,
      exitTime: ev?.exit?.toISOString() ?? null,
      exitManual: ev?.exitManual ?? false,
      exitEventId: ev?.exitEventId ?? null,
      exitNotes: ev?.exitNotes ?? null,
      confidence: ev?.confidence ?? null,
    };
  });

  // Summary
  const present = rows.filter((r) => r.status !== 'absent').length;
  const absent = rows.filter((r) => r.status === 'absent').length;
  const left = rows.filter((r) => r.status === 'left').length;
  const entryOnly = rows.filter((r) => r.status === 'entry_only').length;

  return NextResponse.json({
    date: date.toISOString().slice(0, 10),
    summary: { total: rows.length, present, absent, left, entryOnly },
    students: rows,
  });
}
