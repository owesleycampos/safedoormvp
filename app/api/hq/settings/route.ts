import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/require-superadmin';


// PUT - Update platform settings
export async function PUT(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const {
    id,
    trialDays,
    essencialPrice,
    profissionalPrice,
    premiumPrice,
    annualDiscount,
    maxStudentsEssencial,
    maxStudentsProfissional,
    maxStudentsPremium,
    maxRecogEssencial,
    maxRecogProfissional,
    maxRecogPremium,
  } = await req.json();

  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  const settings = await prisma.platformSettings.update({
    where: { id },
    data: {
      trialDays,
      essencialPrice,
      profissionalPrice,
      premiumPrice,
      annualDiscount,
      maxStudentsEssencial,
      maxStudentsProfissional,
      maxStudentsPremium,
      ...(maxRecogEssencial !== undefined && { maxRecogEssencial }),
      ...(maxRecogProfissional !== undefined && { maxRecogProfissional }),
      ...(maxRecogPremium !== undefined && { maxRecogPremium }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'PlatformSettings',
      entityId: id,
    },
  });

  return NextResponse.json({ success: true, settings });
}
