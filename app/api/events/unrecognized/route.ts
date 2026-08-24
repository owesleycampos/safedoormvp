import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAgent } from '@/lib/agent-auth';

/**
 * POST /api/events/unrecognized
 *
 * Logs an unrecognized face captured by a camera agent.
 * The schoolId is derived from the authenticated device — the payload
 * cannot write into another tenant.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { deviceId, photoUrl, confidenceScore, timestamp } = body;

  const auth = await authenticateAgent(req, deviceId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  // Only URLs the web app can render — a tablet-local file path is useless here.
  if (!photoUrl || !(/^https?:\/\//.test(photoUrl) || photoUrl.startsWith('/'))) {
    return NextResponse.json({ error: 'photoUrl must be an accessible URL' }, { status: 400 });
  }

  const log = await prisma.unrecognizedFaceLog.create({
    data: {
      schoolId: auth.schoolId,
      deviceId: auth.deviceId,
      photoUrl,
      confidenceScore,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    },
  });

  return NextResponse.json({ success: true, logId: log.id }, { status: 201 });
}
