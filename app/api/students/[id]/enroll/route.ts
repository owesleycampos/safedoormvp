import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

const ENROLLMENT_URL = process.env.AGENT_ENROLLMENT_URL || 'http://localhost:8001';
const AGENT_SECRET = process.env.AGENT_API_SECRET || '';

/**
 * POST /api/students/[id]/enroll
 *
 * Extracts a face embedding from the student's profile photo by calling
 * the Python enrollment server (enrollment_server.py), then stores the
 * encrypted vector in the student record (faceVector field).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;
  const studentId = params.id;

  // ── Find the student ──────────────────────────────────────────────
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      photos: {
        orderBy: [{ isProfile: 'desc' }, { createdAt: 'asc' }],
        take: 1,
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
  }

  const profilePhoto = student.photos[0];
  if (!profilePhoto) {
    return NextResponse.json({
      error: 'Nenhuma foto cadastrada. Adicione ao menos uma foto antes de treinar a biometria.',
    }, { status: 400 });
  }

  // ── Read the photo from disk ──────────────────────────────────────
  // Photos are stored at /public/uploads/students/{id}/filename.ext
  const photoPath = path.join(process.cwd(), 'public', profilePhoto.url);

  if (!fs.existsSync(photoPath)) {
    return NextResponse.json({
      error: 'Arquivo de foto não encontrado no servidor.',
    }, { status: 404 });
  }

  // ── Call Python enrollment server ─────────────────────────────────
  try {
    const fileBuffer = fs.readFileSync(photoPath);
    const ext = path.extname(photoPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const mime = mimeMap[ext] || 'image/jpeg';

    const blob = new Blob([fileBuffer], { type: mime });
    const formData = new FormData();
    formData.append('file', blob, `photo${ext}`);

    const response = await fetch(`${ENROLLMENT_URL}/enroll`, {
      method: 'POST',
      headers: { 'x-agent-secret': AGENT_SECRET },
      body: formData,
      signal: AbortSignal.timeout(30_000), // 30s — dlib can be slow on first run
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json({
        error: `Falha no reconhecimento facial: ${err.detail || response.statusText}`,
      }, { status: response.status === 422 ? 422 : 502 });
    }

    const result = await response.json();
    const faceVectorB64: string = result.faceVectorB64;

    if (!faceVectorB64) {
      return NextResponse.json({ error: 'Vetor facial não retornado pelo servidor.' }, { status: 500 });
    }

    // ── Store encrypted vector ────────────────────────────────────────
    const faceVectorBuffer = Buffer.from(faceVectorB64, 'base64');

    await prisma.student.update({
      where: { id: studentId },
      data: { faceVector: faceVectorBuffer },
    });

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any)?.id,
        action: 'BIOMETRIC_ENROLLED',
        entityType: 'Student',
        entityId: studentId,
        metadata: JSON.stringify({
          studentName: student.name,
          photoId: profilePhoto.id,
          dimensions: result.dimensions,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Biometria de ${student.name} treinada com sucesso!`,
      hasFaceVector: true,
      dimensions: result.dimensions,
    });

  } catch (error: any) {
    // Connection refused or timeout → enrollment server not running
    if (
      error.name === 'TimeoutError' ||
      error.cause?.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED')
    ) {
      return NextResponse.json({
        error:
          'Servidor de reconhecimento facial offline. ' +
          'Inicie o agente Python: cd agent-python && python enrollment_server.py',
      }, { status: 503 });
    }

    console.error('[enroll] Error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar biometria.' }, { status: 500 });
  }
}
