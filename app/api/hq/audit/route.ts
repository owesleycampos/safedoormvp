import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/require-superadmin';

/**
 * GET /api/hq/audit?action=&limit= — trilha de auditoria da plataforma.
 * O AuditLog acumulava 29 tipos de evento e não tinha NENHUM leitor.
 */
export async function GET(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100') || 100));

  const logs = await prisma.auditLog.findMany({
    where: action ? { action } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, action: true, entityType: true, entityId: true,
      userId: true, metadata: true, ipAddress: true, createdAt: true,
    },
  });

  // Nome/e-mail de quem agiu, resolvido em lote.
  const userIds = Array.from(new Set(logs.map(l => l.userId).filter(Boolean))) as string[];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const actorOf = (id: string | null) => {
    if (!id) return null;
    const u = users.find(x => x.id === id);
    return u ? { name: u.name, email: u.email } : null;
  };

  const distinctActions = await prisma.auditLog.findMany({
    distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' }, take: 60,
  });

  return NextResponse.json({
    logs: logs.map(l => ({ ...l, actor: actorOf(l.userId) })),
    actions: distinctActions.map(a => a.action),
  });
}
