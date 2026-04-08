import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') return null;
  return session;
}

// POST - Create invoice
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { schoolId, amount, dueDate, description } = await req.json();

  if (!schoolId || !amount || !dueDate) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      schoolId,
      amount,
      dueDate: new Date(dueDate),
      description,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      metadata: JSON.stringify({ schoolId, amount, dueDate }),
    },
  });

  return NextResponse.json({ success: true, invoice }, { status: 201 });
}

// PATCH - Update invoice status
export async function PATCH(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { invoiceId, status, paidAt, paymentMethod } = await req.json();

  if (!invoiceId || !['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'].includes(status)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      ...(paidAt && { paidAt: new Date(paidAt) }),
      ...(paymentMethod && { paymentMethod }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: status === 'PAID' ? 'INVOICE_PAID' : 'INVOICE_UPDATED',
      entityType: 'Invoice',
      entityId: invoiceId,
      metadata: JSON.stringify({ status, amount: invoice.amount }),
    },
  });

  return NextResponse.json({ success: true, invoice });
}
