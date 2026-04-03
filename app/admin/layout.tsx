import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminMobileHeader } from '@/components/admin/mobile-header';
import { AdminMobileBottomNav } from '@/components/admin/mobile-bottom-nav';

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
        {/* Add bottom padding on mobile so content isn't hidden by bottom nav */}
        <div className="flex-1 flex flex-col pb-[calc(3.25rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </div>
      </div>

      {/* Mobile bottom tab bar — hidden on desktop */}
      <AdminMobileBottomNav />
    </div>
  );
}
