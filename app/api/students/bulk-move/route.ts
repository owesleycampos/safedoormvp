import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * POST /api/students/bulk-move — { studentIds: string[], classId: string }
 *
 * Passagem de ano sem redigitar a escola inteira: seleciona os aprovados e
 * move para a turma nova; quem reprovou fica. Vínculos com responsáveis,
 * biometria e histórico moram no ALUNO, então nada disso se perde.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { studentIds, classId } = body;
  if (!Array.isArray(studentIds) || studentIds.length === 0 || !classId) {
    return NextResponse.json({ error: 'Informe os alunos e a turma de destino.' }, { status: 400 });
  }
  if (studentIds.length > 500) {
    return NextResponse.json({ error: 'Máximo de 500 alunos por vez.' }, { status: 400 });
  }

  const targetClass = await prisma.class.findFirst({
    where: { id: classId, schoolId: auth.schoolId },
    select: { id: true, name: true },
  });
  if (!targetClass) {
    return NextResponse.json({ error: 'Turma de destino não encontrada.' }, { status: 404 });
  }

  // updateMany com escopo de escola: ids de outra escola são simplesmente
  // ignorados pelo filtro, nunca movidos.
  const result = await prisma.student.updateMany({
    where: { id: { in: studentIds.map(String) }, schoolId: auth.schoolId },
    data: { classId },
  });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id,
      action: 'STUDENTS_BULK_MOVED',
      entityType: 'Class',
      entityId: classId,
      metadata: JSON.stringify({ count: result.count, className: targetClass.name }),
    },
  });

  return NextResponse.json({
    moved: result.count,
    className: targetClass.name,
    message: `${result.count} aluno${result.count !== 1 ? 's' : ''} movido${result.count !== 1 ? 's' : ''} para ${targetClass.name}.`,
  });
}
