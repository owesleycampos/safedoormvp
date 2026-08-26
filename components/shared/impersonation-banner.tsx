'use client';

import { useEffect, useState } from 'react';

/**
 * Faixa fixa enquanto o dono do SaaS está vendo a tela como outro usuário.
 * Lê o cookie-marcador (não-httpOnly) hq-imp; a volta restaura a sessão
 * original do superadmin.
 */
export function ImpersonationBanner() {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )hq-imp=([^;]+)/);
    setName(m ? decodeURIComponent(m[1]) : null);
  }, []);

  if (!name) return null;

  async function handleRestore() {
    setBusy(true);
    try {
      const res = await fetch('/api/hq/restore', { method: 'POST' });
      const data = await res.json();
      window.location.href = res.ok ? data.dest || '/hq' : '/auth/login';
    } catch {
      window.location.href = '/auth/login';
    }
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-[90] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <span className="truncate">Você está vendo como <strong>{name}</strong></span>
      <button
        type="button"
        onClick={handleRestore}
        disabled={busy}
        className="flex-shrink-0 rounded-md bg-black/80 px-3 py-1 text-xs font-semibold text-white hover:bg-black transition-colors disabled:opacity-60"
      >
        {busy ? 'Voltando...' : 'Voltar ao painel do dono'}
      </button>
    </div>
  );
}
