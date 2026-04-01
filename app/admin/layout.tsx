import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminMobileHeader } from '@/components/admin/mobile-header';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/auth/login');
  if ((session.user as any)?.role !== 'ADMIN') redirect('/pwa/children');

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <AdminSidebar />

      {/* Main content */}
      <div className="flex-1 lg:ml-[220px] min-h-screen flex flex-col">
        {/* Mobile top bar — hidden on desktop */}
        <AdminMobileHeader />
        {children}
      </div>
    </div>
  );
}
