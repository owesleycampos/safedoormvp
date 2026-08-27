import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { clientIp, rateLimitOk } from '@/lib/rate-limit';
import { z } from 'zod';

/**
 * POST /api/auth/register-school — cadastro self-serve de uma escola.
 * Cria School (em TRIAL), SchoolSettings, o usuário ADMIN e a assinatura,
 * guardando o perfil colhido no formulário para o dono ver no dossiê.
 */
export async function POST(req: NextRequest) {
  if (!rateLimitOk(`register-school:${clientIp(req)}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  let raw: any;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  // Honeypot: um campo escondido que humano nunca preenche. Bot que preenche
  // tudo cai aqui e recebe 200 falso (sem criar nada) — não aprende o filtro.
  if (typeof raw.website === 'string' && raw.website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  // Validação de schema (zod): tipos e limites explícitos em vez de checagem
  // manual campo a campo, cortando payloads malformados na porta.
  const schema = z.object({
    schoolName: z.string().trim().min(2).max(120),
    ownerName: z.string().trim().min(2).max(120),
    ownerPhone: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().email().max(160),
    password: z.string().min(8).max(200),
    city: z.string().trim().max(80).optional().nullable(),
    state: z.string().trim().max(2).optional().nullable(),
    sizeStudents: z.string().max(20).optional().nullable(),
    revenueBand: z.string().max(20).optional().nullable(),
    yearsInMarket: z.string().max(20).optional().nullable(),
    usesRecognition: z.string().max(20).optional().nullable(),
    lgpdAccepted: z.literal(true),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Preencha os campos corretamente e aceite os termos.' }, { status: 400 });
  }
  const {
    schoolName, ownerName, ownerPhone, email, password, city, state,
    sizeStudents, revenueBand, yearsInMarket, usesRecognition,
  } = parsed.data;

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
