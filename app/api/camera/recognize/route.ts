import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as rekognition from '@/lib/rekognition';
import { requireActiveSchool } from '@/lib/require-active-school';
import { getRecognitionGate, reserveRecognition } from '@/lib/recognition-usage';

/**
 * GET /api/camera/recognize
 * Health-check: returns 503 if AWS Rekognition is not configured.
 */
export async function GET() {
  if (!rekognition.isConfigured()) {
    return NextResponse.json(
      { error: 'AWS Rekognition não configurado.' },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/camera/recognize
 *
 * Accepts a video frame as FormData ('image' field, JPEG blob).
 * Searches the school's Rekognition Collection for matching faces.
 * Returns matched students.
 *
 * Response:
 * {
 *   matches: [{
 *     studentId: string | null,
 *     name: string,
 *     photoUrl: string | null,
 *     className: string | null,
 *     confidence: number,       ← 0..1 (similarity / 100)
 *     box: null                 ← Rekognition SearchFacesByImage doesn't return a box
 *   }],
 *   faceCount: number
 * }
 *
 * AWS Rekognition free tier: 5,000 images/month.
 * SearchFacesByImage = 1 call (detect + identify in one step).
 * Camera can send frames every 1–2 seconds safely.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  if (!rekognition.isConfigured()) {
    return NextResponse.json(
      { error: 'AWS Rekognition não configurado.' },
      { status: 503 }
    );
  }

  const schoolId = auth.schoolId;

  // Contingência (pausa) + cota + minConfidence numa consulta só.
  const gate = await getRecognitionGate(schoolId);
  if (gate.paused) {
    return NextResponse.json({ error: gate.paused.error }, { status: gate.paused.status });
  }
  const faceMatchThreshold = Math.max(50, Math.min(99, Math.round(gate.minConfidence * 100)));

  // ── Parse image from FormData ──────────────────────────────────────────────
  let imageBytes: Buffer;
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Campo "image" não encontrado no FormData.' }, { status: 400 });
    }
    imageBytes = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'Erro ao processar imagem.' }, { status: 400 });
  }

  // RESERVA a chamada ANTES da AWS (atômico, aguardado): a AWS cobra por
  // chamada, então o teto tem que barrar antes de gastar. Sem slot → 429.
  const reserved = await reserveRecognition(schoolId, gate.cap, auth.timezone);
  if (!reserved) {
    return NextResponse.json(
      { error: `Cota mensal de reconhecimentos do plano atingida (${gate.cap.toLocaleString('pt-BR')}). O registro manual continua funcionando.` },
      { status: 429 }
    );
  }

  const collectionId = schoolId;

  try {
    // ── Search for matching faces ──────────────────────────────────────────
    const { matches: faceMatches, box } = await rekognition.searchFacesByImage(
      collectionId, imageBytes, faceMatchThreshold
    );

    if (faceMatches.length === 0) {
      return NextResponse.json({ matches: [], faceCount: 0 });
    }

    // ── Look up best match in DB ───────────────────────────────────────────
    const bestMatch = faceMatches[0];
    const student = await prisma.student.findFirst({
      where: {
        id: bestMatch.studentId,
        schoolId,
        isActive: true,
        recognitionEnabled: true,
      },
      select: {
        id: true,
        name: true,
        photoUrl: true,
        class: { select: { name: true } },
      },
    });

    if (student) {
      return NextResponse.json({
        matches: [{
          studentId: student.id,
          name: student.name,
          photoUrl: student.photoUrl,
          className: student.class?.name ?? null,
          confidence: bestMatch.similarity / 100, // normalize to 0..1
          box, // AWS fraction-based bounding box (0–1) or null
        }],
        faceCount: 1,
      });
    }

    return NextResponse.json({ matches: [], faceCount: 0 });
  } catch (err: any) {
    console.error('[recognize] AWS Rekognition error:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao reconhecer via AWS Rekognition.' },
      { status: 500 }
    );
  }
}
