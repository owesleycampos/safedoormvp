import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { PwaTabBar } from '@/components/pwa/tab-bar';

export default async function PwaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/auth/login');
  if ((session.user as any)?.role !== 'PARENT') redirect('/admin/dashboard');

  return (
    <div
      className="flex flex-col min-h-screen bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <PwaTabBar />
    </div>
  );
}
