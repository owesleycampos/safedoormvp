import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function verifyAdminAndStudent(req: NextRequest, id: string) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return null;

  const schoolId = (session.user as any)?.schoolId;
  const student = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!student) return null;

  return { session, schoolId, student };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const student = await prisma.student.findUnique({
    where: { id: params.id },
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
    },
  });

  return NextResponse.json({ student: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAndStudent(req, params.id);
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  await prisma.student.update({
    where: { id: params.id },
    data: { isActive: false },
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
