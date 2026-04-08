import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') return null;
  return session;
}

// PUT - Update webhook configuration
export async function PUT(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { webhookSecret, paymentProvider } = await req.json();

  let settings = await prisma.platformSettings.findFirst();
  if (!settings) {
    settings = await prisma.platformSettings.create({ data: {} });
  }

  const data: any = {};
  if (paymentProvider) data.paymentProvider = paymentProvider;
  if (webhookSecret) data.webhookSecret = webhookSecret;

  await prisma.platformSettings.update({
    where: { id: settings.id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'WEBHOOK_CONFIG_UPDATED',
      entityType: 'PlatformSettings',
      entityId: settings.id,
      metadata: JSON.stringify({ paymentProvider, secretUpdated: !!webhookSecret }),
    },
  });

  return NextResponse.json({ success: true });
}

// PATCH - Retry failed webhook event
export async function PATCH(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { eventId, action } = await req.json();

  if (action === 'retry' && eventId) {
    // Reset status to RECEIVED so it can be reprocessed
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'RECEIVED', errorMessage: null, processedAt: null },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
