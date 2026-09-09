import { NextRequest, NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import { validateImageUpload } from '@/lib/upload-guard';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

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
  // Teto do logo é 2MB (menor que o das fotos). Depois, tipo + magic bytes
  // pelo guard central — que NÃO aceita SVG de propósito: um SVG salvo no Blob
  // público e aberto direto é vetor de XSS armazenado.
  if (file instanceof File && file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: 'O logo deve ter no máximo 2MB.' }, { status: 413 });
  }
  const validated = await validateImageUpload(file);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }

  const old = await prisma.school.findUnique({
    where: { id: auth.schoolId },
    select: { logoUrl: true },
  });

  const blob = await put(`school-logos/${auth.schoolId}/logo.${validated.ext}`, validated.bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType: validated.type,
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
