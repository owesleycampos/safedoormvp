import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * A tela de Dispositivos sempre chamou PATCH e DELETE aqui, mas a rota
 * nunca existiu — editar ou remover um dispositivo falhava. Como a tela era
 * órfã (fora da navegação), ninguém esbarrava no buraco até ela ser
 * publicada na Fase 4.
 */

async function deviceInScope(deviceId: string, schoolId: string) {
  return prisma.device.findFirst({
    where: { id: deviceId, schoolId },
    include: { _count: { select: { attendanceEvents: true } } },
  });
}

/** PATCH /api/devices/[id] — nome, descrição e tipo. A apiKey nunca muda aqui. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const device = await deviceInScope(params.id, auth.schoolId);
  if (!device) return NextResponse.json({ error: 'Dispositivo não encontrado.' }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  }

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: {
      ...(name !== undefined && { name }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.type !== undefined && { type: body.type }),
    },
    include: { _count: { select: { attendanceEvents: true } } },
  });

  return NextResponse.json({ device: updated });
}

/**
 * DELETE /api/devices/[id]
 * Recusado enquanto houver eventos de presença apontando para o
 * dispositivo — apagar quebraria o histórico. O caminho é desativar o
 * aparelho (a chave para de valer quando o registro some, então remover um
 * device COM histórico exigiria apagar presença de alunos, o que não
 * fazemos daqui).
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const device = await deviceInScope(params.id, auth.schoolId);
  if (!device) return NextResponse.json({ error: 'Dispositivo não encontrado.' }, { status: 404 });

  if (device._count.attendanceEvents > 0) {
    return NextResponse.json(
      {
        error: `Este dispositivo tem ${device._count.attendanceEvents} registro(s) de presença vinculados e não pode ser removido — o histórico dos alunos aponta para ele. Renomeie-o (ex.: "Desativado") se quiser tirá-lo de uso.`,
      },
      { status: 409 }
    );
  }

  await prisma.device.delete({ where: { id: device.id } });

  await prisma.auditLog.create({
    data: {
      userId: (auth.session.user as any)?.id ?? null,
      action: 'DEVICE_DELETED',
      entityType: 'Device',
      entityId: device.id,
      metadata: JSON.stringify({ name: device.name }),
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
