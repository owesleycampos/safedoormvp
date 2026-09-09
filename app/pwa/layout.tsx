import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { PwaTabBar } from '@/components/pwa/tab-bar';

export default async function PwaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/auth/login');
  const role = (session.user as any)?.role;
  // FALHA FECHADO (ver comentário gêmeo em app/admin/layout.tsx): sem papel,
  // os dois layouts se redirecionavam mutuamente em loop.
  if (!role) redirect('/auth/login');
  if (role === 'SUPERADMIN') redirect('/hq');
  if (role !== 'PARENT') redirect('/admin/dashboard');

  return (
    <div
      className="flex flex-col min-h-screen bg-background"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <PwaTabBar />
    </div>
  );
}
