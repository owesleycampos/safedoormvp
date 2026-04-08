import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminMobileHeader } from '@/components/admin/mobile-header';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/auth/login');
  if ((session.user as any)?.role !== 'ADMIN') redirect('/pwa/children');

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
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
