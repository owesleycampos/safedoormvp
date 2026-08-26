'use client';

import { ArrowLeft } from 'lucide-react';

/**
 * Voltar das páginas legais. Elas são abertas de vários contextos (cadastro,
 * convite, perfil do app), então history.back() devolve o leitor exatamente
 * para onde estava; sem histórico (link aberto direto), cai no início.
 */
export function BackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = '/';
      }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </button>
  );
}
