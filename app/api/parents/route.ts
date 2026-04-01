import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const limit = parseInt(searchParams.get('limit') || '20');

  const parents = await prisma.parent.findMany({
    where: {
      user: {
        schoolId,
        ...(search && {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }),
      },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      students: {
        include: { student: { select: { id: true, name: true } } },
        take: 3,
      },
    },
    orderBy: { name: 'asc' },
    take: limit,
  });

  return NextResponse.json({ parents });
}
