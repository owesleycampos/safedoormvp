/**
 * POST /api/notifications/test — notificação de teste para o próprio
 * responsável logado.
 *
 * Deixa o pai confirmar que os avisos chegam SEM tocar em nenhum dado de
 * presença: nada é gravado em AttendanceEvent, nenhum aluno é envolvido —
 * o push vai apenas para as inscrições do próprio chamador.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendPushToSubscription } from '@/lib/notifications';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'PARENT') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const userId = (session.user as any)?.id as string;
  const parent = await prisma.parent.findUnique({
    where: { userId },
    select: { pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } } },
  });

  if (!parent || parent.pushSubscriptions.length === 0) {
    return NextResponse.json(
      { sent: 0, error: 'Nenhum aparelho inscrito. Ative as notificações primeiro.' },
      { status: 409 }
    );
  }

  // Awaited: em serverless a função congela ao responder — fire-and-forget
  // aqui repetiria o bug que deixou os pushes de presença mudos em produção.
  let sent = 0;
  for (const sub of parent.pushSubscriptions) {
    const ok = await sendPushToSubscription(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      {
        title: 'Porta Segura — Teste de notificação',
        body: 'Tudo certo! É assim que você receberá os avisos de entrada e saída.',
        tag: 'notification-test',
      },
      sub.id
    );
    if (ok) sent++;
  }

  return NextResponse.json({ sent });
}
