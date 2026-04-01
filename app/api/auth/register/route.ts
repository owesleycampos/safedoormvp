import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, lgpdAccepted } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }

    if (!lgpdAccepted) {
      return NextResponse.json({ error: 'Aceite dos termos LGPD é obrigatório.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'E-mail já cadastrado.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'PARENT',
        lgpdAccepted: true,
        lgpdAcceptedAt: new Date(),
        parent: {
          create: {
            name,
            phone: phone || null,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        metadata: JSON.stringify({ email: user.email, role: user.role }),
      },
    });

    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
