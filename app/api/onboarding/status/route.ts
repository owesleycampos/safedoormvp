import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/onboarding/status
 *
 * Retorna o status de onboarding da escola:
 * - Turmas criadas
 * - Alunos cadastrados
 * - Fotos enviadas
 * - Responsáveis vinculados
 * - Dispositivo configurado
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const role = (session.user as any).role;
  const schoolId = (session.user as any).schoolId;

  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  if (!schoolId) {
    return NextResponse.json({ error: 'Escola não encontrada.' }, { status: 400 });
  }

  const [classesCount, studentsCount, studentsWithPhotos, parentsLinked, devicesCount] =
    await Promise.all([
      prisma.class.count({ where: { schoolId } }),
      prisma.student.count({ where: { schoolId } }),
      prisma.student.count({
        where: {
          schoolId,
          photos: { some: {} },
        },
      }),
      prisma.studentParent.count({
        where: {
          student: { schoolId },
        },
      }),
      prisma.device.count({ where: { schoolId } }),
    ]);

  const steps = [
    {
      key: 'classes',
      label: 'Criar primeira turma',
      completed: classesCount > 0,
      href: '/admin/classes',
    },
    {
      key: 'students',
      label: 'Adicionar alunos',
      completed: studentsCount > 0,
      href: '/admin/students',
    },
    {
      key: 'photos',
      label: 'Upload de fotos',
      completed: studentsWithPhotos > 0,
      href: '/admin/students',
    },
    {
      key: 'parents',
      label: 'Vincular responsáveis',
      completed: parentsLinked > 0,
      href: '/admin/parents',
    },
    {
      key: 'devices',
      label: 'Configurar câmera',
      completed: devicesCount > 0,
      href: '/admin/camera',
    },
  ];

  const completedSteps = steps.filter((s) => s.completed).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return NextResponse.json({ steps, progress });
}
