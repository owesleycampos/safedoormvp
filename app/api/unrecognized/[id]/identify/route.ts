import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * POST /api/unrecognized/[id]/identify — { studentId }
 *
 * "Este rosto é o aluno X": a captura vira foto de treino do aluno e o
 * registro sai da fila. Fecha o ciclo que faltava — a fila só permitia
 * descartar, nunca corrigir a causa (aluno sem foto boa o suficiente).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: 'Informe o aluno.' }, { status: 400 });

  const [log, student] = await Promise.all([
    prisma.unrecognizedFaceLog.findFirst({
      where: { id: params.id, schoolId: auth.schoolId },
      select: { id: true, photoUrl: true },
    }),
    prisma.student.findFirst({
      where: { id: studentId, schoolId: auth.schoolId, isActive: true },
      select: { id: true, name: true, _count: { select: { photos: true } } },
    }),
  ]);
  if (!log) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });
  if (student._count.photos >= 10) {
    return NextResponse.json(
      { error: `${student.name} já tem 10 fotos (máximo). Remova uma antes de adicionar a captura.` },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.studentPhoto.create({
      data: {
        studentId: student.id,
        url: log.photoUrl,
        label: 'Captura da portaria',
        isProfile: false,
      },
    }),
    prisma.unrecognizedFaceLog.update({
      where: { id: log.id },
      data: {
        reviewed: true,
        reviewedAt: new Date(),
        reviewedById: (auth.session.user as any)?.id ?? null,
        notes: `Identificado como ${student.name}`,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    message: `Captura adicionada às fotos de ${student.name}. Refaça o cadastro facial na ficha do aluno para o reconhecimento aprender com ela.`,
  });
}
