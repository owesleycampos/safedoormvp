import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import {
  detectProvider, normalizeEvent, processWebhookEvent, logWebhook,
} from '@/lib/payment-webhooks';

/**
 * POST /api/webhooks/payments
 *
 * Generic webhook receiver for payment gateways (Stripe, Asaas, MercadoPago, PagarMe).
 * Receives payment events, logs them, and auto-updates subscriptions/invoices.
 *
 * Headers:
 *   x-webhook-secret: shared secret for validation
 *   x-provider: "STRIPE" | "ASAAS" | "MERCADOPAGO" | "PAGARME" (optional, auto-detected)
 *
 * The endpoint is public (no session required) since gateways call it directly.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let payload: any;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate webhook secret. When a secret is configured, EVERY request
  // must authenticate — an unauthenticated request can otherwise fake a
  // "payment confirmed" and reactivate a suspended school.
  const settings = await prisma.platformSettings.findFirst();
  const webhookSecret = settings?.webhookSecret;

  if (webhookSecret) {
    const headerSecret = req.headers.get('x-webhook-secret');
    const signatureHeader = req.headers.get('x-signature') || req.headers.get('stripe-signature');

    // Simple secret match or HMAC validation
    if (headerSecret) {
      if (headerSecret !== webhookSecret) {
        await logWebhook('UNKNOWN', null, 'auth.failed', 'FAILED', rawBody, null, null, null, 'Invalid webhook secret');
        return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
      }
    } else if (signatureHeader) {
      const hmac = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      const sigBuf = Buffer.from(signatureHeader);
      const hmacBuf = Buffer.from(hmac);
      // timingSafeEqual throws on length mismatch — a mismatched length IS an invalid signature
      const valid = sigBuf.length === hmacBuf.length && crypto.timingSafeEqual(sigBuf, hmacBuf);
      if (!valid) {
        await logWebhook('UNKNOWN', null, 'auth.failed', 'FAILED', rawBody, null, null, null, 'Invalid HMAC signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      await logWebhook('UNKNOWN', null, 'auth.failed', 'FAILED', rawBody, null, null, null, 'Missing webhook authentication');
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }
  }

  // Detect provider
  const providerHeader = req.headers.get('x-provider')?.toUpperCase();
  const provider = providerHeader || detectProvider(payload);

  // Normalize event
  const normalized = normalizeEvent(provider, payload);

  // Idempotency: a replayed webhook (gateway retry, manual replay) must not
  // process twice — e.g. marking two invoices as paid for one payment.
  if (normalized.externalId) {
    const duplicate = await prisma.webhookEvent.findFirst({
      where: {
        provider,
        externalId: normalized.externalId,
        eventType: normalized.eventType,
        status: 'PROCESSED',
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ received: true, duplicate: true, eventId: duplicate.id });
    }
  }

  // Log the raw webhook
  const event = await logWebhook(
    provider,
    normalized.externalId,
    normalized.eventType,
    'RECEIVED',
    rawBody,
    null, null, null, null
  );

  // Process the event
  try {
    await processWebhookEvent(event.id, provider, normalized, payload);
  } catch (err: any) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: 'FAILED', errorMessage: err.message || 'Processing error' },
    });
    // Still return 200 to avoid gateway retries for processing errors
  }

  return NextResponse.json({ received: true, eventId: event.id });
}

// ── Provider Detection ──────────────────────────────────
