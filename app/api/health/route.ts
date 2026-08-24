import { NextResponse } from 'next/server';

/**
 * GET /api/health — lightweight connectivity probe.
 * Used by the camera agent instead of downloading the full face-vector
 * payload just to test whether it is online.
 */
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
