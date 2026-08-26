/**
 * Consentimento biométrico do aluno (LGPD).
 *
 * POST — a secretaria registra um consentimento colhido em papel
 *        (matrícula, termo assinado). Body: { authorizedBy: string }
 * DELETE — REVOGA o consentimento e apaga a biometria de verdade:
 *        remove as faces do Rekognition, desliga o reconhecimento e limpa
 *        o registro. As fotos e o histórico de presença permanecem.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';
import * as rekognition from '@/lib/rekognition';

async function studentInScope(id: string, schoolId: string) {
  return prisma.student.findFirst({
    where: { id, schoolId },
    select: { id: true, name: true, schoolId: true, rekognitionFaceIds: true, azurePersonId: true },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const student = await studentInScope(params.id, auth.schoolId);
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const authorizedBy = typeof body.authorizedBy === 'string' ? body.authorizedBy.trim() : '';
  if (!authorizedBy) {
    return NextResponse.json({ error: 'Informe quem autorizou (nome do responsável).' }, { status: 400 });
  }

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: { biometricConsentAt: new Date(), biometricConsentName: authorizedBy },
    select: { biometricConsentAt: true, biometricConsentName: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id ?? null,
      action: 'BIOMETRIC_CONSENT_RECORDED',
      entityType: 'Student',
      entityId: student.id,
      metadata: JSON.stringify({ studentName: student.name, authorizedBy }),
    },
  }).catch(() => {});

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const student = await studentInScope(params.id, auth.schoolId);
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 });

  // Apaga as faces indexadas no Rekognition (quando configurado)
  let facesDeleted = 0;
  if (rekognition.isConfigured() && student.azurePersonId) {
    let known: string[] = [];
    try { known = student.rekognitionFaceIds ? JSON.parse(student.rekognitionFaceIds) : []; } catch {}
    facesDeleted = await rekognition
      .deleteFacesForStudent(student.schoolId, student.id, known)
      .catch(() => 0);
  }

  await prisma.student.update({
    where: { id: student.id },
    data: {
      biometricConsentAt: null,
      biometricConsentName: null,
      azurePersonId: null,
      rekognitionFaceIds: null,
      faceVector: null,
      recognitionEnabled: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id ?? null,
      action: 'BIOMETRIC_DATA_DELETED',
      entityType: 'Student',
      entityId: student.id,
      metadata: JSON.stringify({ studentName: student.name, facesDeleted }),
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, facesDeleted });
}
