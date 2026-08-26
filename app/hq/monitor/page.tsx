import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MonitorClient } from './monitor-client';

export const metadata = { title: 'Monitoramento' };

export default async function MonitorPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') redirect('/auth/login');
  return <MonitorClient />;
}
