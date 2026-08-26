import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { detectProvider, normalizeEvent, processWebhookEvent } from '@/lib/payment-webhooks';

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
    // Reprocessamento REAL: o retry antigo só marcava RECEIVED (que nada
    // consome) e apagava a mensagem de erro — o evento morria em silêncio.
    const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });

    let payload: any;
    try { payload = JSON.parse(event.payload || '{}'); } catch {
      return NextResponse.json({ error: 'Payload do evento é ilegível.' }, { status: 422 });
    }

    const provider = event.provider || detectProvider(payload);
    const normalized = normalizeEvent(provider, payload);
    try {
      await processWebhookEvent(event.id, provider, normalized, payload);
      return NextResponse.json({ success: true, reprocessed: true });
    } catch (err: any) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED', errorMessage: err.message || 'Erro no reprocessamento' },
      });
      return NextResponse.json({ error: err.message || 'Falha ao reprocessar.' }, { status: 422 });
    }
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
