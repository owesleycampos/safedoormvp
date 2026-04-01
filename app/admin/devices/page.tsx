import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/header';
import { DevicesClient } from '@/components/admin/devices-client';

export const metadata = { title: 'Dispositivos' };

async function getDevicesData(schoolId: string) {
  const devices = await prisma.device.findMany({
    where: { schoolId },
    include: {
      _count: { select: { attendanceEvents: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return devices;
}

export default async function DevicesPage() {
  const session = await getServerSession(authOptions);
  const schoolId = (session?.user as any)?.schoolId;
  const devices = await getDevicesData(schoolId);

  const online = devices.filter((d) => d.status === 'ONLINE').length;
  const offline = devices.filter((d) => d.status === 'OFFLINE').length;
  const error = devices.filter((d) => d.status === 'ERROR').length;

  return (
    <div className="flex flex-col flex-1 page-enter">
      <AdminHeader
        title="Dispositivos"
        subtitle={`${devices.length} dispositivo${devices.length !== 1 ? 's' : ''} — ${online} online, ${offline} offline${error > 0 ? `, ${error} com erro` : ''}`}
      />
      <div className="flex-1 p-4 md:p-6">
        <DevicesClient devices={devices as any} schoolId={schoolId} />
      </div>
    </div>
  );
}
