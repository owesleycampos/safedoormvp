import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UnrecognizedClient } from '@/components/admin/unrecognized-client';

export const metadata = { title: 'Não Identificados' };

async function getUnrecognizedData(schoolId: string) {
  const logs = await prisma.unrecognizedFaceLog.findMany({
    where: { schoolId },
    include: {
      device: { select: { id: true, name: true, type: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });
  return logs;
}

export default async function UnrecognizedPage() {
  const session = await getServerSession(authOptions);
  const schoolId = (session?.user as any)?.schoolId;
  const logs = await getUnrecognizedData(schoolId);

  return (
    <div className="flex flex-col flex-1">
      <UnrecognizedClient logs={logs} />
    </div>
  );
}
