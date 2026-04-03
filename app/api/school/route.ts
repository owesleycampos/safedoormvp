import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true, name: true, cnpj: true, address: true,
      city: true, state: true, contactEmail: true, contactPhone: true, logoUrl: true,
    },
  });

  if (!school) return NextResponse.json({ error: 'Escola não encontrada' }, { status: 404 });
  return NextResponse.json(school);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;

  try {
    const body = await req.json();
    const { name, cnpj, address, city, state, contactEmail, contactPhone } = body;

    const school = await prisma.school.update({
      where: { id: schoolId },
      data: {
        ...(name !== undefined && { name }),
        ...(cnpj !== undefined && { cnpj }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
      },
    });
    return NextResponse.json(school);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
