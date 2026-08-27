/**
 * POST /api/agent/photos — upload de fotos capturadas pelo agente da portaria.
 *
 * Fecha o TODO que deixava os eventos do tablet sem imagem: o agente salvava
 * a foto no próprio aparelho e mandava o caminho local como photoUrl, que
 * virava link quebrado no painel (e depois passou a ser descartado). Agora o
 * agente envia o arquivo para cá, o servidor guarda no Vercel Blob e devolve
 * a URL pública que entra no evento de presença ou no log de não
 * reconhecido.
 *
 * Auth: a mesma do agente (chave do dispositivo), o que também define a
 * pasta — uma escola nunca escreve no espaço da outra.
 */
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { validateImageUpload } from '@/lib/upload-guard';
import { authenticateAgent } from '@/lib/agent-auth';

const MAX_BYTES = 5 * 1024 * 1024; // frames JPEG do agente têm ~50-150KB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  const auth = await authenticateAgent(req, req.headers.get('x-device-id'));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Sem storage configurado o agente segue funcionando — o evento é
    // registrado sem foto em vez de travar a presença.
    return NextResponse.json({ error: 'Armazenamento de fotos não configurado.' }, { status: 503 });
  }

  let photo: File | null = null;
  try {
    const form = await req.formData();
    const field = form.get('photo');
    if (field instanceof File) photo = field;
  } catch {
    return NextResponse.json({ error: 'Envie multipart/form-data com o campo "photo".' }, { status: 400 });
  }

  const valid = await validateImageUpload(photo);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: valid.status });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `agent-photos/${auth.schoolId}/${auth.deviceId}/${stamp}.${valid.ext}`;

  const blob = await put(key, valid.bytes, { access: 'public', addRandomSuffix: true, contentType: valid.type });

  return NextResponse.json({ url: blob.url }, { status: 201 });
}
