import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * Escopo obrigatório: a foto precisa pertencer ao aluno E o aluno à escola
 * da sessão. Sem isso, um admin de outra escola conseguia trocar/apagar
 * fotos de treino biométrico de qualquer aluno do sistema.
 */
async function findScopedPhoto(schoolId: string, studentId: string, photoId: string) {
  return prisma.studentPhoto.findFirst({
    where: { id: photoId, studentId, student: { schoolId } },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const photo = await findScopedPhoto(auth.schoolId, params.id, params.photoId);
  if (!photo) return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });

  // Transação: sem ela, uma falha no meio deixava student.photoUrl
  // apontando para uma foto que não é mais a de perfil.
  await prisma.$transaction([
    prisma.studentPhoto.updateMany({
      where: { studentId: params.id, isProfile: true },
      data: { isProfile: false },
    }),
    prisma.studentPhoto.update({
      where: { id: params.photoId },
      data: { isProfile: true },
    }),
    prisma.student.update({
      where: { id: params.id },
      data: { photoUrl: photo.url },
    }),
  ]);

  return NextResponse.json({ photo: { ...photo, isProfile: true } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const photo = await findScopedPhoto(auth.schoolId, params.id, params.photoId);
  if (!photo) return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });

  // O arquivo vive no Vercel Blob — o fs.unlink antigo tentava apagar um
  // caminho local que nunca existiu e o blob ficava órfão para sempre.
  if (photo.url.includes('blob.vercel-storage.com')) {
    try { await del(photo.url); } catch { /* blob já ausente não bloqueia */ }
  }

  await prisma.studentPhoto.delete({ where: { id: params.photoId } });

  // If was profile photo, set next available as profile
  if (photo.isProfile) {
    const next = await prisma.studentPhoto.findFirst({
      where: { studentId: params.id },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await prisma.$transaction([
        prisma.studentPhoto.update({ where: { id: next.id }, data: { isProfile: true } }),
        prisma.student.update({ where: { id: params.id }, data: { photoUrl: next.url } }),
      ]);
    } else {
      await prisma.student.update({ where: { id: params.id }, data: { photoUrl: null } });
    }
  }

  return NextResponse.json({ ok: true });
}
