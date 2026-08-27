import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const userId = (session.user as any)?.id;
  const subscription = await req.json();

  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const parent = await prisma.parent.findUnique({ where: { userId } });
  const schoolId = (session.user as any)?.schoolId || null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      parentId: parent?.id || null,
      // Sem schoolId os avisos escola-inteira (resumo diário) pulavam
      // toda inscrição criada pela interface real.
      schoolId,
      userAgent: req.headers.get('user-agent') || undefined,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      // RE-VINCULA ao chamador atual. Em aparelho compartilhado (mesmo
      // navegador, pais diferentes) o endpoint é o mesmo: sem reatribuir
      // parentId, o pai B recebia os avisos do filho do pai A.
      parentId: parent?.id || null,
      userAgent: req.headers.get('user-agent') || undefined,
      ...(schoolId ? { schoolId } : {}),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { endpoint } = await req.json();
  // Só as próprias inscrições: sem o filtro de dono, qualquer sessão
  // apagava a inscrição de qualquer pessoa conhecendo o endpoint.
  const userId = (session.user as any)?.id;
  const parent = await prisma.parent.findUnique({ where: { userId }, select: { id: true } });
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, ...(parent ? { parentId: parent.id } : { parentId: null }) },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
