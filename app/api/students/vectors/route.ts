/**
 * Returns encrypted face vectors for all active students in a school.
 * Used by the Python agent to sync face data to the device.
 * Protected by device API key.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-device-api-key');
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 401 });

  const device = await prisma.device.findUnique({ where: { apiKey } });
  if (!device) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

  // Update device status
  await prisma.device.update({
    where: { id: device.id },
    data: { lastSeen: new Date(), status: 'ONLINE' },
  }).catch(() => {});

  const students = await prisma.student.findMany({
    where: { schoolId: device.schoolId, isActive: true },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      faceVector: true,
      faceVectorVersion: true,
      class: { select: { name: true } },
    },
  });

  // Send faceVector as base64 for the Python agent to decode
  const data = students.map((s) => ({
    id: s.id,
    name: s.name,
    photoUrl: s.photoUrl,
    className: s.class?.name,
    faceVectorVersion: s.faceVectorVersion,
    faceVectorB64: s.faceVector ? s.faceVector.toString('base64') : null,
  }));

  return NextResponse.json({
    deviceId: device.id,
    schoolId: device.schoolId,
    students: data,
    syncedAt: new Date().toISOString(),
  });
}
