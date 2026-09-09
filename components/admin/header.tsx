'use client';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  return (
    // `flex` sem quebra e sem `min-w-0`: quando titulo + subtitulo + botoes nao
    // cabiam, o header CRESCIA alem da tela e a pagina inteira passava a rolar
    // de lado (medido em Dispositivos: 428px numa tela de 375). Agora quebra em
    // duas linhas no celular e o texto pode encolher.
    <header className="flex flex-wrap items-center justify-between gap-3 py-6 px-5 md:px-8 border-b border-border">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
