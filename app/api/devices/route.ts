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
  const devices = await prisma.device.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ devices });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;
  const { name, description, type } = await req.json();

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

  const device = await prisma.device.create({
    data: {
      schoolId,
      name,
      description,
      type: type || 'TABLET',
      status: 'OFFLINE',
    },
  });

  return NextResponse.json({ device }, { status: 201 });
}
