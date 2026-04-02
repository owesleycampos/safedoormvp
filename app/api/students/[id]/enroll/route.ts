import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as rekognition from '@/lib/rekognition';

/**
 * POST /api/students/[id]/enroll
 *
 * Enrolls a student's face biometrics using AWS Rekognition.
 * All photos in the student's gallery are sent to Rekognition,
 * which stores the face embeddings server-side in a Collection.
 *
 * No body required — the server fetches the student's photos from the DB.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!rekognition.isConfigured()) {
    return NextResponse.json(
      { error: 'AWS Rekognition não configurado. Adicione AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY nas variáveis de ambiente.' },
      { status: 503 }
    );
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const studentId = params.id;

  // ── Find student + all photos ──────────────────────────────────────────────
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      photos: { orderBy: [{ isProfile: 'desc' }, { createdAt: 'asc' }] },
    },
  });

  if (!student) {
    return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
  }

  if (student.photos.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma foto cadastrada. Adicione ao menos uma foto antes de treinar a biometria.' },
      { status: 400 }
    );
  }

  // Rekognition Collection ID = schoolId
  const collectionId = schoolId;

  try {
    // ── 1. Ensure Collection exists for this school ────────────────────────
    await rekognition.ensureCollection(collectionId);

    // ── 2. Remove previous faces for this student (clean re-enroll) ───────
    await rekognition.deleteFacesForStudent(collectionId, studentId);

    // ── 3. Index each photo ────────────────────────────────────────────────
    let facesAdded = 0;
    let skippedPhotos = 0;

    for (const photo of student.photos) {
      // Fetch the image bytes from the URL (Vercel Blob or any HTTPS URL)
      let imageBuffer: Buffer;
      try {
        const res = await fetch(photo.url);
        if (!res.ok) { skippedPhotos++; continue; }
        imageBuffer = Buffer.from(await res.arrayBuffer());
      } catch {
        skippedPhotos++;
        continue;
      }

      const faceIds = await rekognition.indexFace(collectionId, imageBuffer, studentId);
      if (faceIds.length > 0) {
        facesAdded++;
      } else {
        skippedPhotos++;
      }
    }

    // If no faces were detected in any photo, abort
    if (facesAdded === 0) {
      return NextResponse.json(
        {
          error:
            'Nenhum rosto detectado nas fotos. Use fotos de frente com boa iluminação e fundo neutro.',
        },
        { status: 400 }
      );
    }

    // ── 4. Mark student as enrolled ────────────────────────────────────────
    // Store studentId in azurePersonId field as enrollment marker
    await prisma.student.update({
      where: { id: studentId },
      data: {
        azurePersonId: studentId,        // marks as enrolled; ExternalImageId = studentId in Rekognition
        faceVector: null,                // legacy field no longer needed
        faceVectorVersion: { increment: 1 },
        recognitionEnabled: true,
      },
    });

    // ── 5. Audit log ──────────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: (session.user as any)?.id,
        action: 'BIOMETRIC_ENROLLED',
        entityType: 'Student',
        entityId: studentId,
        metadata: JSON.stringify({
          studentName: student.name,
          method: 'aws-rekognition',
          photosUsed: facesAdded,
          totalPhotos: student.photos.length,
          skippedPhotos,
        }),
      },
    });

    const total = student.photos.length;
    return NextResponse.json({
      success: true,
      message: `Biometria de ${student.name} treinada com sucesso! (${facesAdded} de ${total} foto${total !== 1 ? 's' : ''} processada${total !== 1 ? 's' : ''})`,
      hasFaceVector: true,
      facesAdded,
      skippedPhotos,
    });
  } catch (err: any) {
    console.error('[enroll] AWS Rekognition error:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao treinar biometria via AWS Rekognition.' },
      { status: 500 }
    );
  }
}
