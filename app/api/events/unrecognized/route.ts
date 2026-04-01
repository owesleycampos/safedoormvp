import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const apiSecret = req.headers.get('x-agent-secret');
  if (apiSecret !== process.env.AGENT_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { schoolId, deviceId, photoUrl, confidenceScore, timestamp } = await req.json();

  if (!schoolId || !deviceId || !photoUrl) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const log = await prisma.unrecognizedFaceLog.create({
    data: {
      schoolId,
      deviceId,
      photoUrl,
      confidenceScore,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    },
  });

  return NextResponse.json({ success: true, logId: log.id }, { status: 201 });
}
