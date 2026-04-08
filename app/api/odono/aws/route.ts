import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') return null;
  return session;
}

// POST - Create AWS account
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { label, accountId, region, maxCollections, monthlyBudget } = await req.json();

  if (!label || !accountId) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const account = await prisma.awsAccount.create({
    data: {
      label,
      accountId,
      region: region || 'us-east-1',
      maxCollections: maxCollections || 100,
      monthlyBudget,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'AWS_ACCOUNT_CREATED',
      entityType: 'AwsAccount',
      entityId: account.id,
      metadata: JSON.stringify({ label, accountId, region }),
    },
  });

  return NextResponse.json({ success: true, account }, { status: 201 });
}

// PATCH - Update AWS account (status, assign school)
export async function PATCH(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();

  if (body.action === 'assign-school') {
    const { awsAccountId, schoolId } = body;
    await prisma.school.update({
      where: { id: schoolId },
      data: { awsAccountId },
    });

    // Update collection count
    const count = await prisma.school.count({ where: { awsAccountId } });
    await prisma.awsAccount.update({
      where: { id: awsAccountId },
      data: { usedCollections: count },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === 'update-status') {
    const { accountId, status } = body;
    if (!['ACTIVE', 'LIMIT_NEAR', 'LIMIT_REACHED', 'DISABLED'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    await prisma.awsAccount.update({
      where: { id: accountId },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any)?.id,
        action: 'AWS_STATUS_CHANGED',
        entityType: 'AwsAccount',
        entityId: accountId,
        metadata: JSON.stringify({ newStatus: status }),
      },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
