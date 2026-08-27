/**
 * Validação central de uploads de imagem.
 *
 * Restringe tipo (só imagens que a portaria usa) e tamanho, e checa a
 * ASSINATURA (magic bytes) do arquivo — não só o content-type, que o
 * cliente controla e pode mentir. Um .exe renomeado para .jpg com
 * content-type forjado não passa.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function sniff(buf: Uint8Array): 'jpeg' | 'png' | 'webp' | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  // WEBP: "RIFF"...."WEBP"
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';
  return null;
}

export interface ValidatedImage {
  ok: true;
  bytes: Buffer;
  type: string;
  ext: 'jpg' | 'png' | 'webp';
}
export interface RejectedImage {
  ok: false;
  error: string;
  status: number;
}

/** Valida um File de imagem vindo de FormData. */
export async function validateImageUpload(file: unknown): Promise<ValidatedImage | RejectedImage> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Envie um arquivo de imagem.', status: 400 };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Imagem muito grande (máx. ${MAX_IMAGE_BYTES / (1024 * 1024)} MB).`, status: 413 };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return { ok: false, error: 'Formato inválido. Use JPG, PNG ou WebP.', status: 415 };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = sniff(new Uint8Array(bytes.subarray(0, 16)));
  if (!kind) {
    return { ok: false, error: 'O arquivo enviado não é uma imagem válida.', status: 415 };
  }
  // Tipo e extensão saem do que os MAGIC BYTES dizem, não do file.type (que o
  // cliente controla). Senão dava para salvar bytes JPEG com Content-Type
  // image/png — um objeto no Blob cujo header mente sobre o conteúdo.
  const ext = kind === 'jpeg' ? 'jpg' : kind;
  const type = kind === 'jpeg' ? 'image/jpeg' : kind === 'png' ? 'image/png' : 'image/webp';
  return { ok: true, bytes, type, ext };
}
