import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * PATCH /api/unrecognized/[id]/review — marca um rosto não reconhecido
 * como revisado. Registra QUEM revisou (relevância LGPD: é uma fila de
 * imagens de menores).
 *
 * Os botões da tela de revisão chamavam esta rota desde o início — ela é
 * que não existia: todo clique era 404 e a fila nunca esvaziava.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const log = await prisma.unrecognizedFaceLog.findFirst({
    where: { id: params.id, schoolId: auth.schoolId },
    select: { id: true },
  });
  if (!log) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });

  const updated = await prisma.unrecognizedFaceLog.update({
    where: { id: params.id },
    data: {
      reviewed: true,
      reviewedAt: new Date(),
      reviewedById: (auth.session.user as any)?.id ?? null,
    },
  });

  return NextResponse.json({ log: updated });
}
