import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as rekognition from '@/lib/rekognition';

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
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!rekognition.isConfigured()) {
    return NextResponse.json(
      { error: 'AWS Rekognition não configurado.' },
      { status: 503 }
    );
  }

  const schoolId = (session.user as any)?.schoolId as string;

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

  const collectionId = schoolId;

  try {
    // ── Search for matching faces ──────────────────────────────────────────
    const faceMatches = await rekognition.searchFacesByImage(collectionId, imageBytes);

    if (faceMatches.length === 0) {
      return NextResponse.json({ matches: [], faceCount: 0 });
    }

    // ── Look up matched students in DB ─────────────────────────────────────
    const matches = await Promise.all(
      faceMatches.map(async (match) => {
        const student = await prisma.student.findFirst({
          where: {
            id: match.studentId,
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
          return {
            studentId: student.id,
            name: student.name,
            photoUrl: student.photoUrl,
            className: student.class?.name ?? null,
            confidence: match.similarity / 100, // normalize to 0..1
            box: null,
          };
        }

        return {
          studentId: null,
          name: 'Rosto não identificado',
          photoUrl: null,
          className: null,
          confidence: 0,
          box: null,
        };
      })
    );

    // Filter to only the best match (highest similarity)
    const validMatches = matches.filter((m) => m.studentId !== null);
    const result = validMatches.length > 0 ? [validMatches[0]] : [];

    return NextResponse.json({ matches: result, faceCount: result.length });
  } catch (err: any) {
    console.error('[recognize] AWS Rekognition error:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao reconhecer via AWS Rekognition.' },
      { status: 500 }
    );
  }
}
