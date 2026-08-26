import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Guard do console do dono (/hq). Estava copiado em 5 rotas — uma fonte só.
 * Retorna a sessão do SUPERADMIN, ou null (a rota responde 401).
 */
export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') {
    return null;
  }
  return session;
}
