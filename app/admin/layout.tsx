import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminMobileHeader } from '@/components/admin/mobile-header';
import { AdminMobileBottomNav } from '@/components/admin/mobile-bottom-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/auth/login');
  const role = (session.user as any)?.role;
  // SUPERADMIN ia para /pwa, cujo layout devolvia para /admin — loop infinito.
  if (role === 'SUPERADMIN') redirect('/hq');
  if (role !== 'ADMIN') redirect('/pwa/children');

  const schoolId = (session.user as any)?.schoolId;
  if (schoolId) {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { status: true } });
    if (school?.status === 'SUSPENDED' || school?.status === 'CANCELLED') {
      redirect('/auth/login?error=school_suspended');
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — always visible on desktop */}
      <AdminSidebar />

      {/* Main */}
      <div className="flex-1 lg:ml-[220px] min-h-screen flex flex-col">
        {/* Mobile header — only on small screens */}
        <AdminMobileHeader />
        {/* Bottom padding on phones so content never hides behind the bar */}
        <main className="flex-1 flex flex-col pb-[calc(3.25rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>

      {/* Phone bottom bar with the day-to-day destinations */}
      <AdminMobileBottomNav />
    </div>
  );
}
