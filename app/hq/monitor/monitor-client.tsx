'use client';

import { useEffect, useState } from 'react';
import { Activity, Users, School, ScanFace, DollarSign, WifiOff, Wifi, AlertTriangle, Pause, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toaster';

function brl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function MonitorClient() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/hq/metrics');
    if (res.ok) setData(await res.json());
  }
  useEffect(() => { load(); }, []);

  async function toggleGlobalPause(paused: boolean) {
    if (!(await confirmDialog({
      title: paused ? 'Pausar o reconhecimento de TODA a plataforma?' : 'Retomar o reconhecimento global?',
      description: paused
        ? 'Nenhuma câmera de nenhuma escola reconhecerá até você retomar. O registro manual continua funcionando. Use em incidente na AWS ou estouro de custo.'
        : 'As câmeras voltam a reconhecer normalmente.',
      confirmLabel: paused ? 'Pausar tudo' : 'Retomar', destructive: paused,
    }))) return;
    setBusy(true);
    try {
      const res = await fetch('/api/hq/recognition-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'global', paused }),
      });
      if (res.ok) { toast({ variant: 'success', title: paused ? 'Reconhecimento pausado' : 'Reconhecimento retomado' }); load(); }
      else toast({ variant: 'destructive', title: 'Falha na operação' });
    } finally { setBusy(false); }
  }

  if (!data) {
    return <div className="p-8"><div className="h-40 rounded-lg bg-muted animate-pulse" /></div>;
  }

  const paused = data.recognition.globalPaused;
  const kpis = [
    { icon: School, label: 'Escolas ativas', value: data.schools.byStatus.ACTIVE ?? 0, sub: `${data.schools.total} no total` },
    { icon: DollarSign, label: 'MRR', value: brl(data.revenue.mrrCents), sub: `${brl(data.revenue.arrCents)} ao ano` },
    { icon: Users, label: 'Alunos ativos', value: data.students.active.toLocaleString('pt-BR'), sub: `${data.parents.toLocaleString('pt-BR')} responsáveis` },
    { icon: ScanFace, label: 'Reconhecimentos no mês', value: (data.recognition.totalThisMonth ?? 0).toLocaleString('pt-BR'), sub: data.recognition.monthKey },
  ];

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 max-w-[1200px] mx-auto w-full">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5" /> Monitoramento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Saúde e uso da plataforma em tempo real.</p>
      </div>

      {/* Contingência global */}
      <Card className={paused ? 'p-4 border-destructive/40 bg-destructive/5' : 'p-4'}>
        <div className="flex items-center gap-3 flex-wrap">
          {paused
            ? <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            : <ScanFace className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold">
              {paused ? 'Reconhecimento PAUSADO em toda a plataforma' : 'Reconhecimento ativo'}
            </p>
            <p className="text-xs text-muted-foreground">
              {paused ? 'Nenhuma câmera reconhece. Registro manual segue disponível.' : 'Contingência: pause tudo em incidente na AWS ou estouro de custo.'}
            </p>
          </div>
          <Button
            variant={paused ? 'default' : 'destructive'}
            onClick={() => toggleGlobalPause(!paused)}
            disabled={busy}
            size="sm"
          >
            {paused ? <><Play className="h-4 w-4 mr-1.5" /> Retomar</> : <><Pause className="h-4 w-4 mr-1.5" /> Pausar tudo</>}
          </Button>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <k.icon className="h-4 w-4" />
              <span className="text-[11px] font-medium uppercase tracking-wider">{k.label}</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight">{k.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Planos + dispositivos */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Assinaturas por plano</h3>
          <div className="space-y-2">
            {Object.entries(data.revenue.planCounts as Record<string, number>).map(([plan, n]) => (
              <div key={plan} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{plan}</span>
                <span className="font-medium tabular-nums">{n}</span>
              </div>
            ))}
            {Object.keys(data.revenue.planCounts).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma assinatura.</p>
            )}
          </div>
          <h3 className="text-sm font-semibold mt-5 mb-3">Dispositivos</h3>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5"><Wifi className="h-4 w-4 text-success" /> {data.devices.ONLINE ?? 0} online</span>
            <span className="flex items-center gap-1.5"><WifiOff className="h-4 w-4 text-muted-foreground" /> {data.devices.OFFLINE ?? 0} offline</span>
            {(data.devices.ERROR ?? 0) > 0 && <span className="flex items-center gap-1.5 text-destructive"><AlertTriangle className="h-4 w-4" /> {data.devices.ERROR} erro</span>}
          </div>
        </Card>

        {/* Top consumidores de reconhecimento */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Maiores consumidores de reconhecimento ({data.recognition.monthKey})</h3>
          <div className="space-y-2">
            {data.recognition.top.length === 0 && <p className="text-xs text-muted-foreground">Sem uso registrado neste mês.</p>}
            {data.recognition.top.map((t: any) => (
              <div key={t.schoolId} className="flex items-center justify-between text-sm">
                <span className="truncate">{t.name}</span>
                <span className="font-medium tabular-nums flex-shrink-0 ml-2">{t.count.toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
          {data.trialsEnding.length > 0 && (
            <>
              <h3 className="text-sm font-semibold mt-5 mb-3">Trials terminando</h3>
              <div className="space-y-2">
                {data.trialsEnding.map((t: any) => (
                  <div key={t.schoolId} className="flex items-center justify-between text-sm">
                    <span className="truncate">{t.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString('pt-BR') : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
