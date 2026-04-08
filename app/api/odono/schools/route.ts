import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') {
    return null;
  }
  return session;
}

// POST - Create new school with admin user and subscription
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { name, cnpj, city, state, contactEmail, contactPhone, plan, billing, adminEmail, adminName, adminPassword } = await req.json();

  if (!name || !plan || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Nome, plano, email e senha do admin são obrigatórios' }, { status: 400 });
  }

  // Check if admin email already exists
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
  if (existingUser) {
    return NextResponse.json({ error: 'Email do admin já está em uso' }, { status: 409 });
  }

  // Get platform pricing
  const settings = await prisma.platformSettings.findFirst();
  const priceMap: Record<string, number> = {
    ESSENCIAL: settings?.essencialPrice || 49700,
    PROFISSIONAL: settings?.profissionalPrice || 99700,
    PREMIUM: settings?.premiumPrice || 0,
  };
  const discount = billing === 'ANNUAL' ? (settings?.annualDiscount || 0.20) : 0;

  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Create school + admin + subscription in a transaction
  const result = await prisma.$transaction(async (tx: any) => {
    const school = await tx.school.create({
      data: {
        name,
        cnpj: cnpj || null,
        city: city || null,
        state: state || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        status: 'ACTIVE',
      },
    });

    // Create school settings with defaults
    await tx.schoolSettings.create({
      data: { schoolId: school.id },
    });

    // Create admin user
    const admin = await tx.user.create({
      data: {
        email: adminEmail.toLowerCase(),
        name: adminName || 'Administrador',
        passwordHash,
        role: 'ADMIN',
        schoolId: school.id,
      },
    });

    // Create subscription
    const subscription = await tx.subscription.create({
      data: {
        schoolId: school.id,
        plan,
        billing: billing || 'MONTHLY',
        status: 'ACTIVE',
        priceMonthly: priceMap[plan] || 49700,
        discount,
      },
    });

    return { school, admin, subscription };
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'SCHOOL_CREATED',
      entityType: 'School',
      entityId: result.school.id,
      metadata: JSON.stringify({ name, plan, adminEmail }),
    },
  });

  return NextResponse.json({ success: true, ...result }, { status: 201 });
}

// PATCH - Update school status (suspend/reactivate)
export async function PATCH(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { schoolId, status } = await req.json();

  if (!schoolId || !['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED'].includes(status)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const school = await prisma.school.update({
    where: { id: schoolId },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: status === 'SUSPENDED' ? 'SCHOOL_SUSPENDED' : 'SCHOOL_REACTIVATED',
      entityType: 'School',
      entityId: schoolId,
      metadata: JSON.stringify({ schoolName: school.name, newStatus: status }),
    },
  });

  return NextResponse.json({ success: true, school });
}
