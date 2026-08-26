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

  // Update device status (+ versão do agente, para o painel saber quais
  // tablets estão rodando código antigo)
  const agentVersion = req.headers.get('x-agent-version');
  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeen: new Date(),
      status: 'ONLINE',
      ...(agentVersion ? { firmwareVersion: agentVersion } : {}),
    },
  }).catch(() => {});

  const [students, settings] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: device.schoolId, isActive: true },
      select: {
        id: true,
        name: true,
        photoUrl: true,
        class: { select: { name: true } },
      },
    }),
    prisma.schoolSettings.findUnique({
      where: { schoolId: device.schoolId },
      select: {
        entryStartTime: true,
        entryEndTime: true,
        exitStartTime: true,
        exitEndTime: true,
        timezone: true,
        minConfidence: true,
      },
    }),
  ]);

  // O embedding local (faceVector) morreu com a migração para o Rekognition;
  // as chaves seguem no payload, sempre nulas, para não quebrar agentes antigos.
  const data = students.map((s) => ({
    id: s.id,
    name: s.name,
    photoUrl: s.photoUrl,
    className: s.class?.name,
    faceVectorVersion: 0,
    faceVectorB64: null,
  }));

  return NextResponse.json({
    deviceId: device.id,
    schoolId: device.schoolId,
    students: data,
    // School schedule so the agent classifies ENTRY/EXIT with the SCHOOL's
    // configuration instead of stale values baked into its local .env.
    settings: settings
      ? {
          entryStart: settings.entryStartTime,
          entryEnd: settings.entryEndTime,
          exitStart: settings.exitStartTime,
          exitEnd: settings.exitEndTime,
          timezone: settings.timezone,
          minConfidence: settings.minConfidence,
        }
      : null,
    syncedAt: new Date().toISOString(),
  });
}
