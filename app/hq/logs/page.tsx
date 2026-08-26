import { prisma } from '@/lib/db';
import { LogsClient } from './logs-client';

export default async function LogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Get unique user IDs to fetch names
  const userIds = Array.from(new Set(logs.map((l) => l.userId).filter(Boolean))) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, role: true, school: { select: { name: true } } },
  });

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const data = logs.map((l) => {
    const user = l.userId ? userMap[l.userId] : null;
    return {
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt.toISOString(),
      userName: user?.name || user?.email || null,
      userRole: user?.role || null,
      schoolName: user?.school?.name || null,
    };
  });

  return <LogsClient logs={data} />;
}
