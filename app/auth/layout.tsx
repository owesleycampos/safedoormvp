import { Logo } from '@/components/shared/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 flex-col items-start justify-between border-r border-border p-10">
        <Logo size="sm" showText />

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground leading-snug">
              Segurança escolar<br />com reconhecimento<br />facial
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Acompanhe em tempo real a entrada e saída dos seus filhos. Notificações instantâneas, sempre.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { value: '98%',  label: 'Precisão de reconhecimento' },
              { value: '<1s',  label: 'Tempo médio de resposta' },
              { value: '24/7', label: 'Monitoramento contínuo'   },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-3">
                <span className="text-xl font-semibold tabular-nums">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {['IA de Ponta', 'LGPD Compliant', 'Offline Ready'].map((f) => (
            <span
              key={f}
              className="px-2.5 py-1 rounded-md text-xs text-muted-foreground border border-border bg-secondary/50"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8">
            <Logo size="sm" showText />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
