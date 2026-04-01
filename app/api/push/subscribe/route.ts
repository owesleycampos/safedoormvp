import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/push/subscribe
 * Saves a Web Push subscription (endpoint + VAPID keys) for the authenticated parent.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const userId = (session.user as any)?.id;
  const schoolId = (session.user as any)?.schoolId;

  const body = await req.json();
  const { endpoint, keys, userAgent } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Dados de subscrição inválidos' }, { status: 400 });
  }

  // Find the parent record linked to this user
  const parent = await prisma.parent.findFirst({
    where: { user: { id: userId } },
  });

  // Upsert — same browser may re-subscribe with new keys
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || req.headers.get('user-agent') || null,
      ...(parent ? { parentId: parent.id } : {}),
      ...(schoolId ? { schoolId } : {}),
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || req.headers.get('user-agent') || null,
    },
  });

  return NextResponse.json({ success: true, id: subscription.id }, { status: 201 });
}

/**
 * DELETE /api/push/subscribe
 * Removes a Web Push subscription by endpoint.
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint obrigatório' }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint } });

  return NextResponse.json({ success: true });
}
