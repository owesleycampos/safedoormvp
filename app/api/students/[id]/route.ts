import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as rekognition from '@/lib/rekognition';

async function verifyAdminAndStudent(req: NextRequest, id: string) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return null;

  const schoolId = (session.user as any)?.schoolId;
  const student = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!student) return null;

  return { session, schoolId, student };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Mesmo guard dos irmãos PUT/PATCH/DELETE: sem ele, qualquer sessão de
  // qualquer escola (inclusive de responsável) lia a ficha completa do
  // aluno — dados biométricos, e-mails dos responsáveis e presença.
  const auth = await verifyAdminAndStudent(req, params.id);
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const student = await prisma.student.findFirst({
    where: { id: params.id, schoolId: auth.schoolId },
    include: {
      class: true,
      photos: { orderBy: [{ isProfile: 'desc' }, { createdAt: 'asc' }] },
      parents: {
        include: {
          parent: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
      },
      attendance: { orderBy: { timestamp: 'desc' }, take: 20 },
    },
  });

  if (!student) return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
  return NextResponse.json({ student });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAndStudent(req, params.id);
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const classId = formData.get('classId') as string;
    const birthDate = formData.get('birthDate') as string;

    // A turma de destino PRECISA ser da mesma escola. Sem isto, o PUT
    // escrevia um classId de outra escola no aluno — ele sumia das listas
    // das duas escolas e corrompia todo relatório por turma.
    if (classId) {
      const cls = await prisma.class.findFirst({
        where: { id: classId, schoolId: auth.schoolId },
        select: { id: true },
      });
      if (!cls) return NextResponse.json({ error: 'Turma inválida.' }, { status: 400 });
    }

    const student = await prisma.student.update({
      where: { id: params.id },
      data: {
        name,
        classId,
        birthDate: birthDate ? new Date(birthDate) : null,
      },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        photos: { where: { isProfile: true }, take: 1 },
        parents: {
          include: {
            parent: {
              include: { user: { select: { email: true, name: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json({ student });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar aluno.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAndStudent(req, params.id);
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const updated = await prisma.student.update({
    where: { id: params.id },
    data: {
      ...(typeof body.recognitionEnabled === 'boolean' && { recognitionEnabled: body.recognitionEnabled }),
      ...(typeof body.notes === 'string' && { notes: body.notes }),
    },
  });

  return NextResponse.json({ student: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAndStudent(req, params.id);
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  // LGPD: remover um aluno tem que APAGAR a biometria dele do Rekognition —
  // o soft-delete deixava o rosto do menor indexado (e ainda cobrando/
  // sendo buscado a cada frame). Espelha o fluxo de revogação de consentimento.
  const student = await prisma.student.findFirst({
    where: { id: params.id, schoolId: auth.schoolId },
    select: { schoolId: true, azurePersonId: true, rekognitionFaceIds: true },
  });
  if (student && rekognition.isConfigured() && student.azurePersonId) {
    let known: string[] = [];
    try { known = student.rekognitionFaceIds ? JSON.parse(student.rekognitionFaceIds) : []; } catch {}
    await rekognition.deleteFacesForStudent(student.schoolId, params.id, known).catch(() => {});
  }

  await prisma.student.update({
    where: { id: params.id },
    data: {
      isActive: false,
      recognitionEnabled: false,
      azurePersonId: null,
      rekognitionFaceIds: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id,
      action: 'STUDENT_DELETED',
      entityType: 'Student',
      entityId: params.id,
    },
  });

  return NextResponse.json({ success: true });
}
