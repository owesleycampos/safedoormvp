import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Visitante sem sessão vê a PÁGINA DE VENDAS, não um formulário de login.
  // Antes a raiz do domínio mandava direto para /auth/login e a landing (que
  // existe e está pronta em /lp) não era alcançável por ninguém — uma escola
  // interessada digitava o endereço e batia numa tela de senha.
  if (!session) {
    redirect('/lp');
  }

  const role = (session.user as any)?.role;

  if (role === 'ADMIN') {
    redirect('/admin/dashboard');
  } else if (role === 'PARENT') {
    redirect('/pwa/children');
  } else if (role === 'SUPERADMIN') {
    redirect('/hq');
  }

  redirect('/auth/login');
}
