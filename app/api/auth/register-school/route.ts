import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { clientIp, rateLimitOk } from '@/lib/rate-limit';

/**
 * POST /api/auth/register-school — cadastro self-serve de uma escola.
 * Cria School (em TRIAL), SchoolSettings, o usuário ADMIN e a assinatura,
 * guardando o perfil colhido no formulário para o dono ver no dossiê.
 */
export async function POST(req: NextRequest) {
  if (!rateLimitOk(`register-school:${clientIp(req)}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const {
    schoolName, ownerName, ownerPhone, email, password, city, state,
    sizeStudents, revenueBand, yearsInMarket, usesRecognition, lgpdAccepted,
  } = body;

  if (!schoolName || !ownerName || !email || !password) {
    return NextResponse.json({ error: 'Preencha nome da escola, seu nome, e-mail e senha.' }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: 'A senha deve ter ao menos 8 caracteres.' }, { status: 400 });
  }
  if (!lgpdAccepted) {
    return NextResponse.json({ error: 'É necessário aceitar os termos.' }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (existing) {
    // Mensagem genérica de propósito, para não ser um oráculo de e-mails.
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro com estes dados.' }, { status: 409 });
  }

  const platform = await prisma.platformSettings.findFirst({
    select: { trialDays: true, essencialPrice: true },
  });
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + (platform?.trialDays ?? 7));
  const essencialPrice = platform?.essencialPrice ?? 49700;

  const passwordHash = await bcrypt.hash(String(password), 12);

  let school;
  try {
  school = await prisma.school.create({
    data: {
      name: String(schoolName).trim(),
      city: city || null,
      state: state || null,
      contactEmail: normalizedEmail,
      contactPhone: ownerPhone || null,
      status: 'TRIAL',
      ownerName: String(ownerName).trim(),
      ownerPhone: ownerPhone || null,
      sizeStudents: sizeStudents || null,
      revenueBand: revenueBand || null,
      yearsInMarket: yearsInMarket || null,
      usesRecognition: usesRecognition || null,
      settings: { create: {} },
      admins: {
        create: {
          name: String(ownerName).trim(),
          email: normalizedEmail,
          passwordHash,
          role: 'ADMIN',
          lgpdAccepted: true,
          lgpdAcceptedAt: new Date(),
        },
      },
      subscription: {
        create: {
          plan: 'ESSENCIAL',
          status: 'TRIAL',
          priceMonthly: essencialPrice,
          trialEndsAt: trialEnds,
        },
      },
    },
    select: { id: true },
  });
  } catch (err: any) {
    // Corrida de e-mail duplicado: dois cadastros simultâneos passam o
    // findUnique e o segundo bate na unique — vira 409 amigável, não 500.
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Não foi possível concluir o cadastro com estes dados.' }, { status: 409 });
    }
    throw err;
  }

  await prisma.auditLog.create({
    data: {
      action: 'SCHOOL_SELF_REGISTERED',
      entityType: 'School',
      entityId: school.id,
      metadata: JSON.stringify({ schoolName, ownerName, email: normalizedEmail }),
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
