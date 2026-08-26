import { prisma } from '@/lib/db';

/**
 * Núcleo do processamento de webhooks de pagamento, extraído da rota para
 * que o "Reprocessar" do /odono possa REALMENTE reprocessar (route files do
 * Next não exportam helpers). A rota pública e o retry usam o mesmo código.
 */

export function detectProvider(payload: any): string {
  if (payload.object === 'event' && payload.type?.startsWith('invoice.')) return 'STRIPE';
  if (payload.object === 'event' && payload.type?.startsWith('customer.subscription.')) return 'STRIPE';
  if (payload.event?.startsWith('PAYMENT_')) return 'ASAAS';
  if (payload.action && payload.data?.id) return 'MERCADOPAGO';
  if (payload.event?.type && payload.event?.data) return 'PAGARME';
  return 'UNKNOWN';
}

// ── Event Normalization ─────────────────────────────────
export interface NormalizedEvent {
  externalId: string | null;
  eventType: string;
  paymentStatus: string | null;
  amount: number | null;       // centavos
  customerEmail: string | null;
  customerDoc: string | null;  // CPF/CNPJ
  externalSubId: string | null;
  externalInvoiceId: string | null;
  paidAt: string | null;
  dueDate: string | null;
  paymentMethod: string | null;
}

export function normalizeEvent(provider: string, payload: any): NormalizedEvent {
  switch (provider) {
    case 'STRIPE':
      return normalizeStripe(payload);
    case 'ASAAS':
      return normalizeAsaas(payload);
    case 'MERCADOPAGO':
      return normalizeMercadoPago(payload);
    case 'PAGARME':
      return normalizePagarMe(payload);
    default:
      return normalizeGeneric(payload);
  }
}

function normalizeStripe(p: any): NormalizedEvent {
  const obj = p.data?.object || {};
  return {
    externalId: p.id,
    eventType: p.type || 'unknown',
    paymentStatus: obj.status || obj.payment_status,
    amount: obj.amount_paid || obj.amount || null,
    customerEmail: obj.customer_email || obj.receipt_email,
    customerDoc: null,
    externalSubId: obj.subscription || null,
    externalInvoiceId: obj.invoice || obj.id,
    paidAt: obj.status_transitions?.paid_at ? new Date(obj.status_transitions.paid_at * 1000).toISOString() : null,
    dueDate: obj.due_date ? new Date(obj.due_date * 1000).toISOString() : null,
    paymentMethod: obj.payment_method_types?.[0] || 'card',
  };
}

function normalizeAsaas(p: any): NormalizedEvent {
  const payment = p.payment || {};
  return {
    externalId: payment.id || p.id,
    eventType: p.event || 'unknown',
    paymentStatus: payment.status,
    amount: payment.value ? Math.round(payment.value * 100) : null,
    customerEmail: payment.customer?.email || null,
    customerDoc: payment.customer?.cpfCnpj || null,
    externalSubId: payment.subscription || null,
    externalInvoiceId: payment.id,
    paidAt: payment.confirmedDate || payment.paymentDate || null,
    dueDate: payment.dueDate || null,
    paymentMethod: payment.billingType?.toLowerCase() || null,
  };
}

function normalizeMercadoPago(p: any): NormalizedEvent {
  const data = p.data || {};
  return {
    externalId: data.id?.toString() || p.id?.toString(),
    eventType: p.action || p.type || 'unknown',
    paymentStatus: data.status,
    amount: data.transaction_amount ? Math.round(data.transaction_amount * 100) : null,
    customerEmail: data.payer?.email || null,
    customerDoc: data.payer?.identification?.number || null,
    externalSubId: data.metadata?.subscription_id || null,
    externalInvoiceId: data.id?.toString(),
    paidAt: data.date_approved || null,
    dueDate: data.date_of_expiration || null,
    paymentMethod: data.payment_type_id || null,
  };
}

function normalizePagarMe(p: any): NormalizedEvent {
  const data = p.data || p.event?.data || {};
  return {
    externalId: data.id || p.id,
    eventType: p.type || p.event?.type || 'unknown',
    paymentStatus: data.status,
    amount: data.amount || null,
    customerEmail: data.customer?.email || null,
    customerDoc: data.customer?.document || null,
    externalSubId: data.subscription?.id || null,
    externalInvoiceId: data.id,
    paidAt: data.paid_at || null,
    dueDate: data.due_at || null,
    paymentMethod: data.payment_method || null,
  };
}

function normalizeGeneric(p: any): NormalizedEvent {
  // Convention: `amount` is already in centavos (Stripe/PagarMe style);
  // `value` is in reais (Asaas style) and needs the *100 conversion.
  const amount =
    p.amount != null ? Math.round(p.amount)
    : p.value != null ? Math.round(p.value * 100)
    : null;
  return {
    externalId: p.id || p.event_id || null,
    eventType: p.type || p.event || p.action || 'unknown',
    paymentStatus: p.status || p.payment_status || null,
    amount,
    customerEmail: p.email || p.customer_email || null,
    customerDoc: p.document || p.cpf || p.cnpj || null,
    externalSubId: p.subscription_id || null,
    externalInvoiceId: p.invoice_id || null,
    paidAt: p.paid_at || p.payment_date || null,
    dueDate: p.due_date || null,
    paymentMethod: p.payment_method || null,
  };
}

// ── Process Event ───────────────────────────────────────
export async function processWebhookEvent(
  webhookEventId: string,
  provider: string,
  normalized: NormalizedEvent,
  _rawPayload: any
) {
  const { eventType, paymentStatus, amount, customerEmail, customerDoc, paidAt, paymentMethod } = normalized;

  // Try to find the school by email or document
  let schoolId: string | null = null;

  if (customerEmail) {
    const user = await prisma.user.findFirst({
      where: { email: customerEmail.toLowerCase(), role: 'ADMIN' },
      select: { schoolId: true },
    });
    schoolId = user?.schoolId || null;
  }

  if (!schoolId && customerDoc) {
    const school = await prisma.school.findFirst({
      where: { cnpj: customerDoc },
      select: { id: true },
    });
    schoolId = school?.id || null;
  }

  // Find subscription
  let subscriptionId: string | null = null;
  if (schoolId) {
    const sub = await prisma.subscription.findUnique({
      where: { schoolId },
      select: { id: true },
    });
    subscriptionId = sub?.id || null;
  }

  // Payment confirmed
  const isPaymentConfirmed =
    eventType.includes('confirmed') ||
    eventType.includes('paid') ||
    eventType.includes('approved') ||
    eventType === 'invoice.payment_succeeded' ||
    eventType === 'PAYMENT_CONFIRMED' ||
    eventType === 'PAYMENT_RECEIVED' ||
    paymentStatus === 'paid' ||
    paymentStatus === 'approved' ||
    paymentStatus === 'CONFIRMED';

  // Payment overdue
  const isPaymentOverdue =
    eventType.includes('overdue') ||
    eventType.includes('past_due') ||
    eventType === 'PAYMENT_OVERDUE' ||
    eventType === 'invoice.payment_failed' ||
    paymentStatus === 'overdue' ||
    paymentStatus === 'OVERDUE';

  // Subscription cancelled
  const isSubscriptionCancelled =
    eventType.includes('cancelled') ||
    eventType.includes('canceled') ||
    eventType.includes('deleted') ||
    eventType === 'customer.subscription.deleted' ||
    eventType === 'SUBSCRIPTION_CANCELLED';

  let invoiceId: string | null = null;

  if (isPaymentConfirmed && schoolId) {
    // Mark/create invoice as paid.
    // Prefer an open invoice whose amount matches the payment; only fall
    // back to the oldest open invoice when no amount matches.
    const openInvoices = await prisma.invoice.findMany({
      where: { schoolId, status: { in: ['PENDING', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
    });
    const existingInvoice =
      (amount != null ? openInvoices.find((inv) => inv.amount === amount) : undefined) ??
      openInvoices[0] ?? null;

    if (existingInvoice) {
      await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          status: 'PAID',
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          paymentMethod: paymentMethod || null,
          reference: normalized.externalInvoiceId,
        },
      });
      invoiceId = existingInvoice.id;
    } else if (amount) {
      const inv = await prisma.invoice.create({
        data: {
          schoolId,
          amount,
          status: 'PAID',
          dueDate: new Date(),
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          paymentMethod: paymentMethod || null,
          reference: normalized.externalInvoiceId,
          description: `Pagamento via ${provider}`,
        },
      });
      invoiceId = inv.id;
    }

    // Ensure subscription is active
    if (subscriptionId) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'ACTIVE' },
      });
    }

    // Ensure school is active
    await prisma.school.update({
      where: { id: schoolId },
      data: { status: 'ACTIVE' },
    });
  }

  if (isPaymentOverdue && schoolId) {
    // Mark subscription as past due
    if (subscriptionId) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'PAST_DUE' },
      });
    }

    // Mark oldest pending invoice as overdue
    const pendingInvoice = await prisma.invoice.findFirst({
      where: { schoolId, status: 'PENDING' },
      orderBy: { dueDate: 'asc' },
    });
    if (pendingInvoice) {
      await prisma.invoice.update({
        where: { id: pendingInvoice.id },
        data: { status: 'OVERDUE' },
      });
      invoiceId = pendingInvoice.id;
    }
  }

  if (isSubscriptionCancelled && schoolId) {
    if (subscriptionId) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }
    await prisma.school.update({
      where: { id: schoolId },
      data: { status: 'CANCELLED' },
    });
  }

  // Update webhook event with processed info
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      status: 'PROCESSED',
      schoolId,
      subscriptionId,
      invoiceId,
      processedAt: new Date(),
    },
  });
}

// ── Helper ──────────────────────────────────────────────
export async function logWebhook(
  provider: string,
  externalId: string | null,
  eventType: string,
  status: string,
  payload: string,
  schoolId: string | null,
  subscriptionId: string | null,
  invoiceId: string | null,
  errorMessage: string | null,
) {
  return prisma.webhookEvent.create({
    data: {
      provider,
      externalId,
      eventType,
      status,
      payload,
      schoolId,
      subscriptionId,
      invoiceId,
      errorMessage,
    },
  });
}
