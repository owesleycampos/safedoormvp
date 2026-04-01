import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/header';
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

  const pending = logs.filter((l) => !l.reviewed).length;

  return (
    <div className="flex flex-col flex-1 page-enter">
      <AdminHeader
        title="Rostos Não Identificados"
        subtitle={`${pending} pendente${pending !== 1 ? 's' : ''} de revisão • ${logs.length} registro${logs.length !== 1 ? 's' : ''} total`}
      />
      <div className="flex-1 p-4 md:p-6">
        <UnrecognizedClient logs={logs} />
      </div>
    </div>
  );
}
