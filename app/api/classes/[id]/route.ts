import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const schoolId = (session.user as any)?.schoolId;

  const cls = await prisma.class.findFirst({
    where: { id: params.id, schoolId },
    include: {
      students: {
        where: { isActive: true },
        include: {
          photos: { where: { isProfile: true }, take: 1 },
          parents: {
            include: {
              parent: { include: { user: { select: { email: true } } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!cls) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });

  return NextResponse.json({ class: cls });
}
