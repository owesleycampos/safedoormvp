import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/parent/profile — o responsável edita o próprio nome e telefone.
 * A tela de perfil sempre chamou esta rota; ela nunca existiu, então
 * "Editar perfil" caía em "Erro ao salvar." em 100% das tentativas.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'PARENT') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const userId = (session.user as any)?.id as string;
  const parent = await prisma.parent.findUnique({ where: { userId }, select: { id: true } });
  if (!parent) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });
  }
  const phone = body.phone !== undefined ? (body.phone ? String(body.phone).trim() : null) : undefined;

  const updated = await prisma.parent.update({
    where: { id: parent.id },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(name !== undefined && { user: { update: { name } } }),
    },
    select: { name: true, phone: true },
  });

  return NextResponse.json(updated);
}
