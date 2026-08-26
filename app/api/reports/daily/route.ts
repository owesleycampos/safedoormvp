import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import { dayRangeForDateStr, localDateStr } from '@/lib/timezone';

/**
 * GET /api/reports/daily?date=YYYY-MM-DD&classId=xxx
 *
 * Daily attendance report for teachers.
 * "Day" means the calendar day in the SCHOOL's timezone.
 */
export async function GET(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const schoolId = auth.schoolId;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');
  const classId = searchParams.get('classId');

  const tz = auth.timezone;
  const targetDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr
    : localDateStr(new Date(), tz);
  const day = dayRangeForDateStr(targetDate, tz);

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

  // Get all events for the (school-local) day
  const events = await prisma.attendanceEvent.findMany({
    where: {
      student: { schoolId, ...(classId ? { classId } : {}) },
      timestamp: { gte: day.start, lt: day.end },
    },
    select: {
      id: true,
      studentId: true,
      eventType: true,
      timestamp: true,
      isManual: true,
      confidence: true,
      notes: true,
      photoUrl: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  // Build lookup: studentId → { entry, exit }
  const eventMap = new Map<string, {
    entry: Date | null;
    entryManual: boolean;
    entryEventId: string | null;
    entryNotes: string | null;
    entryPhotoUrl: string | null;
    exit: Date | null;
    exitManual: boolean;
    exitEventId: string | null;
    exitNotes: string | null;
    exitPhotoUrl: string | null;
    confidence: number | null;
  }>();

  for (const ev of events) {
    if (!eventMap.has(ev.studentId)) {
      eventMap.set(ev.studentId, {
        entry: null, entryManual: false, entryEventId: null, entryNotes: null,
        entryPhotoUrl: null,
        exit: null, exitManual: false, exitEventId: null, exitNotes: null,
        exitPhotoUrl: null,
        confidence: null,
      });
    }
    const record = eventMap.get(ev.studentId)!;
    if (ev.eventType === 'ENTRY' && !record.entry) {
      record.entry = ev.timestamp;
      record.entryManual = ev.isManual;
      record.entryEventId = ev.id;
      record.entryNotes = ev.notes;
      record.entryPhotoUrl = ev.photoUrl;
      record.confidence = ev.confidence;
    }
    if (ev.eventType === 'EXIT') {
      // Take the latest exit
      record.exit = ev.timestamp;
      record.exitManual = ev.isManual;
      record.exitEventId = ev.id;
      record.exitNotes = ev.notes;
      record.exitPhotoUrl = ev.photoUrl;
    }
  }

  const rows = students.map((s) => {
    const ev = eventMap.get(s.id);
    // exit_only = an EXIT exists with no ENTRY — an inconsistency worth
    // surfacing (wrong camera mode, entry never captured), NOT an absence.
    let status: 'present' | 'absent' | 'left' | 'entry_only' | 'exit_only';
    if (!ev || (!ev.entry && !ev.exit)) {
      status = 'absent';
    } else if (ev.entry && ev.exit) {
      status = 'left';
    } else if (ev.entry) {
      status = 'entry_only';
    } else {
      status = 'exit_only';
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
      entryPhotoUrl: ev?.entryPhotoUrl ?? null,
      exitTime: ev?.exit?.toISOString() ?? null,
      exitManual: ev?.exitManual ?? false,
      exitEventId: ev?.exitEventId ?? null,
      exitNotes: ev?.exitNotes ?? null,
      exitPhotoUrl: ev?.exitPhotoUrl ?? null,
      confidence: ev?.confidence ?? null,
    };
  });

  // Summary
  const present = rows.filter((r) => r.status !== 'absent').length;
  const absent = rows.filter((r) => r.status === 'absent').length;
  const left = rows.filter((r) => r.status === 'left').length;
  const entryOnly = rows.filter((r) => r.status === 'entry_only').length;
  const exitOnly = rows.filter((r) => r.status === 'exit_only').length;

  return NextResponse.json({
    date: targetDate,
    summary: { total: rows.length, present, absent, left, entryOnly, exitOnly },
    students: rows,
  });
}
