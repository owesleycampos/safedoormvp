import { NextRequest, NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * POST /api/school/logo — sobe o logo da escola para o Blob e persiste.
 * O controle "Alterar logo" era um placebo: mostrava o preview local e
 * nunca salvava nada — o PDF continuava com uma caixa escrita "Logo".
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Armazenamento de arquivos não configurado.' }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Envie um arquivo de imagem.' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'O logo deve ter no máximo 2MB.' }, { status: 400 });
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido. Use PNG, JPG, WebP ou SVG.' }, { status: 400 });
  }

  const old = await prisma.school.findUnique({
    where: { id: auth.schoolId },
    select: { logoUrl: true },
  });

  const ext =
    file.type === 'image/png' ? 'png' :
    file.type === 'image/webp' ? 'webp' :
    file.type === 'image/svg+xml' ? 'svg' : 'jpg';
  const blob = await put(`school-logos/${auth.schoolId}/logo.${ext}`, file, {
    access: 'public',
    addRandomSuffix: true,
  });

  await prisma.school.update({
    where: { id: auth.schoolId },
    data: { logoUrl: blob.url },
  });

  // O logo anterior sai do Blob para não acumular órfãos.
  if (old?.logoUrl?.includes('blob.vercel-storage.com')) {
    try { await del(old.logoUrl); } catch { /* já ausente */ }
  }

  return NextResponse.json({ logoUrl: blob.url });
}

export async function DELETE() {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const old = await prisma.school.findUnique({
    where: { id: auth.schoolId },
    select: { logoUrl: true },
  });
  await prisma.school.update({ where: { id: auth.schoolId }, data: { logoUrl: null } });
  if (old?.logoUrl?.includes('blob.vercel-storage.com')) {
    try { await del(old.logoUrl); } catch { /* já ausente */ }
  }
  return NextResponse.json({ ok: true });
}
