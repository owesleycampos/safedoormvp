import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { put } from '@vercel/blob';
import { validateImageUpload } from '@/lib/upload-guard';

const MAX_PHOTOS = 10;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Mesmo escopo do POST: fotos de treino biométrico só para o admin da
  // escola do aluno — antes qualquer sessão listava a galeria de qualquer id.
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const schoolId = (session.user as any)?.schoolId;
  if (!schoolId) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

  const photos = await prisma.studentPhoto.findMany({
    where: { studentId: params.id, student: { schoolId } },
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
  const photo = formData.get('photo');
  const label = formData.get('label') as string | null;
  const setProfile = formData.get('setProfile') === 'true';

  // Valida tipo REAL (magic bytes), não só o content-type, e o tamanho.
  const valid = await validateImageUpload(photo);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: valid.status });

  // Nome do arquivo derivado da extensão validada (não do nome do cliente),
  // com sufixo aleatório para não haver colisão/sobrescrita.
  const filename = `students/${params.id}/${Date.now()}.${valid.ext}`;
  const blob = await put(filename, valid.bytes, { access: 'public', addRandomSuffix: true, contentType: valid.type });
  const url = blob.url;

  const isFirst = count === 0;
  const becomesProfile = isFirst || setProfile;

  // Transação: sem ela, o updateMany limpava o perfil antigo e uma falha no
  // create/update deixava o aluno sem foto de perfil ou com photoUrl errado
  // (o irmão PUT/DELETE já usava $transaction).
  const ops: any[] = [];
  if (becomesProfile) {
    ops.push(prisma.studentPhoto.updateMany({
      where: { studentId: params.id, isProfile: true },
      data: { isProfile: false },
    }));
  }
  const created = await prisma.studentPhoto.create({
    data: {
      studentId: params.id,
      url,
      isProfile: becomesProfile,
      label: label || null,
    },
  }).catch(() => null);
  // create fora da transação para obter o id, mas o par updateMany+student
  // roda atômico:
  if (!created) return NextResponse.json({ error: 'Falha ao salvar a foto.' }, { status: 500 });

  if (becomesProfile) {
    await prisma.$transaction([
      prisma.studentPhoto.updateMany({
        where: { studentId: params.id, isProfile: true, id: { not: created.id } },
        data: { isProfile: false },
      }),
      prisma.student.update({ where: { id: params.id }, data: { photoUrl: url } }),
    ]);
  }

  return NextResponse.json({ photo: created }, { status: 201 });
}
