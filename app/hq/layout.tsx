import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SuperAdminSidebar } from '@/components/superadmin/sidebar';
import { SuperAdminMobileHeader } from '@/components/superadmin/mobile-header';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/auth/login');
  if ((session.user as any)?.role !== 'SUPERADMIN') redirect('/auth/login');

  return (
    <div className="flex min-h-screen bg-background">
      <SuperAdminSidebar />
      {/* min-w-0: mesma armadilha do layout do admin — sem isto a coluna cresce
          alem da tela por causa de qualquer tabela larga e a pagina inteira
          rola de lado (medido: 435px numa tela de 375 em Faturamento). */}
      <div className="flex-1 lg:ml-[220px] min-h-screen min-w-0 flex flex-col">
        <SuperAdminMobileHeader />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
