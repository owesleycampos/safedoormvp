import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SchoolDossierClient } from './dossier-client';

export const metadata = { title: 'Escola' };

export default async function SchoolDossierPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') redirect('/auth/login');
  return <SchoolDossierClient schoolId={params.id} />;
}
