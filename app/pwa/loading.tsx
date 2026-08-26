/**
 * Esqueleto entre as abas do app dos pais. Sem ele, tocar em Filhos /
 * Histórico / Perfil deixava a tela ANTERIOR congelada até o servidor
 * responder — a "demora ao clicar" que o usuário sentia.
 */
export default function PwaLoading() {
  return (
    <div className="px-4 py-5 space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="skeleton h-6 w-36" />
        <div className="skeleton h-3 w-48" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-24" />
            </div>
          </div>
          <div className="skeleton h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
