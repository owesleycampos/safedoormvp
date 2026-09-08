import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIp, rateLimitOk } from '@/lib/rate-limit';

/**
 * GET /api/invites/[token] — endpoint PÚBLICO (o link da turma circula em grupo
 * de WhatsApp). Devolve a turma e a lista de nomes para o responsável escolher
 * o filho.
 *
 * Três cuidados, porque isto é aberto na internet:
 *  - NÃO devolve photoUrl: um link repassado exporia a FOTO de todos os menores
 *    da turma para qualquer pessoa, sem login e sem rastro.
 *  - Rate-limit por IP: o link também é a porta de entrada do /claim, então
 *    enumerar turmas por aqui não pode ser barato.
 *  - Escola SUSPENSA/CANCELADA não serve mais dados, mesmo com link antigo.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  if (!rateLimitOk(`invite-get:${clientIp(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos.' },
      { status: 429 }
    );
  }

  const invite = await prisma.classInvite.findUnique({
    where: { token: params.token },
    include: {
      class: { select: { id: true, name: true, grade: true } },
      school: { select: { name: true, logoUrl: true, status: true } },
    },
  });

  if (!invite || !invite.isActive || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Link inválido ou expirado.' },
      { status: 404 }
    );
  }
  if (invite.school.status === 'SUSPENDED' || invite.school.status === 'CANCELLED') {
    // Mesma resposta do link inválido: não revela o estado comercial da escola.
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: { classId: invite.classId, isActive: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    school: { name: invite.school.name, logoUrl: invite.school.logoUrl },
    class: invite.class,
    students,
    expiresAt: invite.expiresAt,
  });
}
