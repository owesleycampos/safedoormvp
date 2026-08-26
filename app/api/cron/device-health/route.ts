/**
 * GET /api/cron/device-health — marca tablets mudos como OFFLINE.
 *
 * O agente põe o dispositivo ONLINE a cada sync (~5 min), mas NADA nunca o
 * marcava OFFLINE — um tablet desligado há uma semana seguia "Online" na
 * tela. Tablet mudo é o sinal nº 1 de churn: a portaria parou de registrar
 * e ninguém percebeu.
 *
 * Regra: ONLINE sem sinal há mais de 15 min → OFFLINE. O dashboard do admin
 * mostra o alerta (offlineDevices em /api/dashboard/stats).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const SILENCE_MIN = 15;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get('authorization');
  return bearer === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - SILENCE_MIN * 60 * 1000);
  const stale = await prisma.device.findMany({
    where: {
      status: 'ONLINE',
      OR: [{ lastSeen: { lt: cutoff } }, { lastSeen: null }],
    },
    select: { id: true, name: true, schoolId: true, lastSeen: true },
  });

  if (stale.length > 0) {
    await prisma.device.updateMany({
      where: { id: { in: stale.map((d) => d.id) } },
      data: { status: 'OFFLINE' },
    });
  }

  return NextResponse.json({
    ok: true,
    markedOffline: stale.map((d) => ({ id: d.id, name: d.name, lastSeen: d.lastSeen })),
  });
}
