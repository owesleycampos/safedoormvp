import { prisma } from '@/lib/db';
import { WebhooksClient } from './webhooks-client';

export default async function WebhooksPage() {
  const [events, settings] = await Promise.all([
    prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.platformSettings.findFirst({
      select: { webhookSecret: true, paymentProvider: true },
    }),
  ]);

  // Stats
  const totalReceived = events.length;
  const processed = events.filter((e) => e.status === 'PROCESSED').length;
  const failed = events.filter((e) => e.status === 'FAILED').length;
  const ignored = events.filter((e) => e.status === 'IGNORED').length;

  // Group by provider
  const byProvider: Record<string, number> = {};
  events.forEach((e) => {
    byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
  });

  // Group by event type
  const byType: Record<string, number> = {};
  events.forEach((e) => {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
  });

  const data = {
    events: events.map((e) => ({
      id: e.id,
      provider: e.provider,
      externalId: e.externalId,
      eventType: e.eventType,
      status: e.status,
      schoolId: e.schoolId,
      subscriptionId: e.subscriptionId,
      invoiceId: e.invoiceId,
      errorMessage: e.errorMessage,
      processedAt: e.processedAt?.toISOString() || null,
      createdAt: e.createdAt.toISOString(),
      payload: e.payload,
    })),
    stats: { totalReceived, processed, failed, ignored },
    byProvider,
    byType,
    config: {
      webhookSecret: settings?.webhookSecret ? '••••••' + settings.webhookSecret.slice(-6) : null,
      paymentProvider: settings?.paymentProvider || 'MANUAL',
      webhookUrl: '/api/webhooks/payments',
    },
  };

  return <WebhooksClient data={data} />;
}
