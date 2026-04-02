import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/students/[id]/enroll
 *
 * Accepts a face descriptor (Float32Array as number[]) computed by face-api.js
 * in the browser. Stores it as a Buffer in student.faceVector.
 *
 * Body: { descriptor: number[] }  — 128 float32 values from face-api.js
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;
  const studentId = params.id;

  // ── Parse body ────────────────────────────────────────────────────
  let descriptor: number[];
  try {
    const body = await req.json();
    descriptor = body.descriptor;
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json(
        { error: 'Descritor facial inválido. Esperado array de 128 valores.' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
  }

  // ── Find the student ──────────────────────────────────────────────
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
  });

  if (!student) {
    return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
  }

  // ── Convert Float32Array descriptor → Buffer (512 bytes) ─────────
  const float32 = new Float32Array(descriptor);
  const faceVectorBuffer = Buffer.from(float32.buffer);

  // ── Store in database ─────────────────────────────────────────────
  await prisma.student.update({
    where: { id: studentId },
    data: {
      faceVector: faceVectorBuffer,
      faceVectorVersion: { increment: 1 },
    },
  });

  // ── Audit log ─────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'BIOMETRIC_ENROLLED',
      entityType: 'Student',
      entityId: studentId,
      metadata: JSON.stringify({
        studentName: student.name,
        method: 'browser-face-api',
        dimensions: 128,
      }),
    },
  });

  return NextResponse.json({
    success: true,
    message: `Biometria de ${student.name} treinada com sucesso!`,
    hasFaceVector: true,
    dimensions: 128,
  });
}
