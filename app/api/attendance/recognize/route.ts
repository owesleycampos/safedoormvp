import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
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
  let photoUrl: string | null = null;

  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      // A câmera envia o frame exato do reconhecimento junto do evento —
      // a prova visual de que era mesmo a criança, para o admin (feed) e
      // para o responsável (histórico). O tablet já fazia isso; a câmera
      // do navegador registrava sem imagem.
      const form = await req.formData();
      studentId = String(form.get('studentId') || '');
      type = String(form.get('type') || '');
      const conf = form.get('confidence');
      confidence = conf != null && conf !== '' ? Number(conf) : null;

      const photo = form.get('photo');
      if (
        photo instanceof File && photo.size > 0 && photo.size <= 5 * 1024 * 1024 &&
        ['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) &&
        process.env.BLOB_READ_WRITE_TOKEN
      ) {
        try {
          const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const blob = await put(
            `camera-photos/${auth.schoolId}/${stamp}.${ext}`,
            photo,
            { access: 'public', addRandomSuffix: true }
          );
          photoUrl = blob.url;
        } catch {
          // Falha de upload nunca bloqueia o registro de presença.
        }
      }
    } else {
      const body = await req.json();
      studentId = body.studentId;
      type = body.type;
      confidence = typeof body.confidence === 'number' ? body.confidence : null;
    }

    if (!studentId || !['ENTRY', 'EXIT'].includes(type)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const result = await registerAttendanceEvent({
    studentId,
    eventType: type as 'ENTRY' | 'EXIT',
    source: 'CAMERA_WEB',
    schoolId: auth.schoolId,
    confidence,
    photoUrl,
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
