import { DashboardClient } from '@/components/admin/dashboard-client';

export const metadata = { title: 'Dashboard' };

/**
 * Casca fina de propósito. A versão anterior fazia 7 consultas no servidor
 * para o cliente refazer TODAS elas no primeiro mount (via
 * /api/dashboard/stats) — o TTFB mais alto do painel comprava dados que
 * viviam milissegundos. De quebra, o SSR calculava "hoje" no fuso do
 * SERVIDOR, divergindo da API (fuso da escola).
 *
 * Agora a página chega instantânea, o esqueleto do cliente segura o
 * primeiro paint e a única fonte dos números é a API, tz-correta.
 */
export default function DashboardPage() {
  return <DashboardClient data={null} />;
}
