import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // Unset current profile photo
  await prisma.studentPhoto.updateMany({
    where: { studentId: params.id, isProfile: true },
    data: { isProfile: false },
  });

  // Set new profile photo
  const photo = await prisma.studentPhoto.update({
    where: { id: params.photoId },
    data: { isProfile: true },
  });

  // Update student.photoUrl
  await prisma.student.update({
    where: { id: params.id },
    data: { photoUrl: photo.url },
  });

  return NextResponse.json({ photo });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const photo = await prisma.studentPhoto.findUnique({ where: { id: params.photoId } });
  if (!photo) return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });

  // Delete file from disk
  try {
    const filepath = path.join(process.cwd(), 'public', photo.url);
    await fs.unlink(filepath);
  } catch (_) { /* file might not exist */ }

  await prisma.studentPhoto.delete({ where: { id: params.photoId } });

  // If was profile photo, set next available as profile
  if (photo.isProfile) {
    const next = await prisma.studentPhoto.findFirst({
      where: { studentId: params.id },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await prisma.studentPhoto.update({ where: { id: next.id }, data: { isProfile: true } });
      await prisma.student.update({ where: { id: params.id }, data: { photoUrl: next.url } });
    } else {
      await prisma.student.update({ where: { id: params.id }, data: { photoUrl: null } });
    }
  }

  return NextResponse.json({ ok: true });
}
