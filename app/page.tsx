import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  const role = (session.user as any)?.role;

  if (role === 'ADMIN') {
    redirect('/admin/dashboard');
  } else if (role === 'PARENT') {
    redirect('/pwa/children');
  }

  redirect('/auth/login');
}
