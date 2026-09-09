/**
 * Webhook endpoint called by the Python AI agent on the tablet
 * when a face is recognized with sufficient confidence.
 *
 * Auth: per-device API key (x-device-api-key) preferred; legacy global
 * x-agent-secret accepted only with a resolvable deviceId. Either way the
 * request is scoped to ONE school and the student must belong to it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAgent } from '@/lib/agent-auth';
import { registerAttendanceEvent } from '@/lib/attendance-service';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    studentId,
    deviceId,
    eventType,
    confidence,
    photoUrl,
    timestamp: rawTimestamp,
  } = body;

  const auth = await authenticateAgent(req, deviceId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  if (!studentId || !eventType || !['ENTRY', 'EXIT'].includes(eventType)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const timestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
  if (isNaN(timestamp.getTime())) {
    return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
  }
  // Relógio adiantado do tablet TRAVA o aluno: o evento entra com data futura,
  // a janela de cooldown (>= agora-60s, sem teto) passa a casar sempre, e todo
  // scan seguinte responde "skipped". A criança fica sem entrada hoje, amanhã e
  // depois — aparecendo como AUSENTE na chamada — até a data alcançar o evento.
  // Aceita uma folga de 5 min para dessincronia normal de relógio.
  if (timestamp.getTime() > Date.now() + 5 * 60_000) {
    return NextResponse.json(
      { error: 'Timestamp no futuro. Verifique o relógio do dispositivo.' },
      { status: 400 }
    );
  }

  // A pausa de contingência (plataforma ou escola) também vale para o
  // tablet — o interruptor "pausar reconhecimento" tinha que parar as
  // câmeras de verdade. Cota/AWS não se aplica (reconhecimento é local).
  const [platform, schoolSettings] = await Promise.all([
    prisma.platformSettings.findFirst({ select: { recognitionPaused: true } }),
    prisma.schoolSettings.findUnique({ where: { schoolId: auth.schoolId }, select: { recognitionPaused: true } }),
  ]);
  if (platform?.recognitionPaused || schoolSettings?.recognitionPaused) {
    return NextResponse.json({ error: 'Reconhecimento pausado.' }, { status: 503 });
  }

  try {
    const result = await registerAttendanceEvent({
      studentId,
      eventType,
      source: 'AGENT',
      schoolId: auth.schoolId, // student must belong to the device's school
      deviceId: auth.deviceId,
      confidence: typeof confidence === 'number' ? confidence : null,
      photoUrl,
      timestamp,
    });

    if (!result.ok) {
      if (result.code === 'STUDENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      if (result.code === 'SCHOOL_INACTIVE') {
        return NextResponse.json({ error: result.message }, { status: 403 });
      }
      if (result.code === 'LOW_CONFIDENCE') {
        return NextResponse.json({ error: 'Confidence below threshold' }, { status: 422 });
      }
      // COOLDOWN / DUPLICATE_ENTRY / STALE_EXIT — successful no-op for the agent
      return NextResponse.json({
        skipped: true,
        reason: result.message,
        existingEventId: result.existingEventId,
      });
    }

    return NextResponse.json(
      { success: true, eventId: result.event.id },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    console.error('Checkin-checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
