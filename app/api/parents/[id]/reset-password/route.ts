import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * POST /api/parents/[id]/reset-password — a escola reseta a senha de um
 * responsável que a esqueceu (não há e-mail transacional configurado, então
 * o caminho é presencial/WhatsApp: a secretaria reseta e envia o link da
 * turma; o responsável define a senha nova por lá, provando o vínculo pela
 * data de nascimento — o mesmo fluxo do primeiro acesso).
 *
 * A senha antiga é apagada, nunca trocada por uma "senha provisória" que
 * viaja em texto puro por WhatsApp.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  // O responsável precisa ter vínculo com aluno DESTA escola.
  const parent = await prisma.parent.findFirst({
    where: {
      id: params.id,
      students: { some: { student: { schoolId: auth.schoolId } } },
    },
    select: { id: true, name: true, userId: true, user: { select: { email: true } } },
  });
  if (!parent) {
    return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: parent.userId },
    data: { passwordHash: null },
  });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id,
      action: 'PARENT_PASSWORD_RESET',
      entityType: 'Parent',
      entityId: parent.id,
      metadata: JSON.stringify({ email: parent.user.email }),
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Senha de ${parent.name} resetada. Envie o link da turma: ao abrir, será pedido para criar a senha nova.`,
  });
}
