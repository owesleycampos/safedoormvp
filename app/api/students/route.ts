import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const schoolId = (session.user as any)?.schoolId;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const classId = searchParams.get('classId');
  const limit = parseInt(searchParams.get('limit') || '50');

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { class: { name: { contains: search } } },
        ],
      }),
      ...(classId && { classId }),
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
    orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
    take: limit,
  });

  return NextResponse.json({ students });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;

  try {
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const classId = formData.get('classId') as string;
    const birthDate = formData.get('birthDate') as string;
    const notes = formData.get('notes') as string | null;

    if (!name || !classId) {
      return NextResponse.json({ error: 'Nome e turma são obrigatórios.' }, { status: 400 });
    }

    // Verify class belongs to school
    const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) return NextResponse.json({ error: 'Turma não encontrada.' }, { status: 404 });

    const student = await prisma.student.create({
      data: {
        name,
        classId,
        schoolId,
        birthDate: birthDate ? new Date(birthDate) : null,
        ...(notes !== null && notes !== undefined ? { notes } : {}),
      },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        photos: true,
        parents: {
          include: {
            parent: {
              include: { user: { select: { email: true, name: true } } },
            },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any)?.id,
        action: 'STUDENT_CREATED',
        entityType: 'Student',
        entityId: student.id,
        metadata: JSON.stringify({ name, classId, schoolId }),
      },
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json({ error: 'Erro ao criar aluno.' }, { status: 500 });
  }
}
