import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AuditClient } from './audit-client';

export const metadata = { title: 'Auditoria' };

export default async function AuditPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') redirect('/auth/login');
  return <AuditClient />;
}
