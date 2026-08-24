import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/require-active-school';
import { registerAttendanceEvent } from '@/lib/attendance-service';

/**
 * POST /api/attendance/recognize
 *
 * Called by the browser camera page when a face is matched.
 * Body: { studentId: string, type: 'ENTRY' | 'EXIT', confidence: number }
 *
 * All rules (cooldown, daily dedup, minConfidence, late/early status,
 * notifications) live in registerAttendanceEvent.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  let studentId: string;
  let type: string;
  let confidence: number | null;

  try {
    const body = await req.json();
    studentId = body.studentId;
    type = body.type;
    confidence = typeof body.confidence === 'number' ? body.confidence : null;

    if (!studentId || !['ENTRY', 'EXIT'].includes(type)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const result = await registerAttendanceEvent({
    studentId,
    eventType: type as 'ENTRY' | 'EXIT',
    source: 'CAMERA_WEB',
    schoolId: auth.schoolId,
    confidence,
  });

  if (!result.ok) {
    if (result.code === 'STUDENT_NOT_FOUND' || result.code === 'SCHOOL_INACTIVE' || result.code === 'LOW_CONFIDENCE') {
      return NextResponse.json({ error: result.message }, { status: result.httpStatus });
    }
    // COOLDOWN / DUPLICATE_ENTRY / STALE_EXIT → informational skip
    return NextResponse.json({
      skipped: true,
      reason: result.code === 'COOLDOWN' ? 'cooldown' : result.message,
      existingEventId: result.existingEventId,
      student: result.student ? { name: result.student.name, photoUrl: result.student.photoUrl } : undefined,
    }, { status: 200 });
  }

  return NextResponse.json({
    success: true,
    student: { name: result.student.name, photoUrl: result.student.photoUrl },
    event: {
      id: result.event.id,
      eventType: result.event.eventType,
      timestamp: result.event.timestamp,
    },
  }, { status: result.created ? 201 : 200 });
}
