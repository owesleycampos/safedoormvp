import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { put } from '@vercel/blob';

const MAX_PHOTOS = 10;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const photos = await prisma.studentPhoto.findMany({
    where: { studentId: params.id },
    orderBy: [{ isProfile: 'desc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ photos });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;

  const student = await prisma.student.findFirst({ where: { id: params.id, schoolId } });
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });

  const count = await prisma.studentPhoto.count({ where: { studentId: params.id } });
  if (count >= MAX_PHOTOS) {
    return NextResponse.json({ error: `Máximo de ${MAX_PHOTOS} fotos por aluno.` }, { status: 400 });
  }

  const formData = await req.formData();
  const photo = formData.get('photo') as File | null;
  const label = formData.get('label') as string | null;
  const setProfile = formData.get('setProfile') === 'true';

  if (!photo || photo.size === 0) {
    return NextResponse.json({ error: 'Foto é obrigatória.' }, { status: 400 });
  }

  if (photo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Foto muito grande. Máximo 10MB.' }, { status: 400 });
  }

  // Upload to Vercel Blob (persistent cloud storage)
  const ext = photo.name.split('.').pop() || 'jpg';
  const filename = `students/${params.id}/${Date.now()}.${ext}`;
  const blob = await put(filename, photo, { access: 'public' });
  const url = blob.url;

  const isFirst = count === 0;
  if (isFirst || setProfile) {
    await prisma.studentPhoto.updateMany({
      where: { studentId: params.id, isProfile: true },
      data: { isProfile: false },
    });
  }

  const newPhoto = await prisma.studentPhoto.create({
    data: {
      studentId: params.id,
      url,
      isProfile: isFirst || setProfile,
      label: label || null,
    },
  });

  if (isFirst || setProfile) {
    await prisma.student.update({
      where: { id: params.id },
      data: { photoUrl: url },
    });
  }

  return NextResponse.json({ photo: newPhoto }, { status: 201 });
}
