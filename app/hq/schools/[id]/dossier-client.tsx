'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Users, GraduationCap, MonitorSmartphone, ScanFace,
  Pause, Play, LogIn, ExternalLink, Wifi, WifiOff,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toaster';

function brl(cents?: number) {
  return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SchoolDossierClient({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/hq/schools/${schoolId}`);
    if (res.ok) setData(await res.json());
  }
  useEffect(() => { load(); }, [schoolId]);

  async function impersonate(userId: string, name: string) {
    if (!(await confirmDialog({
      title: `Abrir a tela como ${name}?`,
      description: 'Você verá o sistema exatamente como este usuário, para suporte ou correção. Uma faixa fixa permite voltar ao painel do dono.',
      confirmLabel: 'Abrir como este usuário',
    }))) return;
    const res = await fetch('/api/hq/impersonate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const d = await res.json();
    if (res.ok) window.location.href = d.dest;
    else toast({ variant: 'destructive', title: 'Erro', description: d.error });
  }

  async function toggleSchoolPause(paused: boolean) {
    if (!(await confirmDialog({
      title: paused ? 'Pausar reconhecimento desta escola?' : 'Retomar reconhecimento desta escola?',
      description: paused
        ? 'As câmeras desta escola param de reconhecer (inadimplência, abuso, incidente). O registro manual continua.'
        : 'As câmeras desta escola voltam a reconhecer.',
      confirmLabel: paused ? 'Pausar escola' : 'Retomar', destructive: paused,
    }))) return;
    setBusy(true);
    try {
      const res = await fetch('/api/hq/recognition-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'school', schoolId, paused }),
      });
      if (res.ok) { toast({ variant: 'success', title: paused ? 'Reconhecimento pausado' : 'Retomado' }); load(); }
      else toast({ variant: 'destructive', title: 'Falha' });
    } finally { setBusy(false); }
  }

  if (!data) return <div className="p-8"><div className="h-40 rounded-lg bg-muted animate-pulse" /></div>;

  const { school, subscription, counts, recognition, today } = data;
  const paused = school.recognitionPaused;

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 max-w-[1100px] mx-auto w-full">
      <Link href="/hq/schools" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Escolas
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{school.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {[school.city, school.state].filter(Boolean).join(' · ')} · {school.status}
            {subscription ? ` · ${subscription.plan} (${subscription.status})` : ' · sem plano'}
          </p>
        </div>
        <Button variant={paused ? 'default' : 'destructive'} onClick={() => toggleSchoolPause(!paused)} disabled={busy} size="sm">
          {paused ? <><Play className="h-4 w-4 mr-1.5" /> Retomar reconhecimento</> : <><Pause className="h-4 w-4 mr-1.5" /> Pausar reconhecimento</>}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Alunos ativos" value={counts.students} />
        <Kpi icon={GraduationCap} label="Turmas" value={counts.classes} />
        <Kpi icon={Users} label="Responsáveis" value={counts.parents} />
        <Kpi icon={MonitorSmartphone} label="Dispositivos" value={counts.devices} />
      </div>

      {/* Reconhecimento: usados / cota / restantes */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ScanFace className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Reconhecimento — {recognition.monthKey}</h3>
          {paused && <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">PAUSADO</span>}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><p className="text-2xl font-semibold tabular-nums">{recognition.usedThisMonth.toLocaleString('pt-BR')}</p><p className="text-[11px] text-muted-foreground">usados no mês</p></div>
          <div><p className="text-2xl font-semibold tabular-nums">{recognition.cap > 0 ? recognition.cap.toLocaleString('pt-BR') : '∞'}</p><p className="text-[11px] text-muted-foreground">cota do plano</p></div>
          <div><p className="text-2xl font-semibold tabular-nums">{recognition.remaining == null ? '∞' : recognition.remaining.toLocaleString('pt-BR')}</p><p className="text-[11px] text-muted-foreground">restantes</p></div>
        </div>
        {recognition.cap > 0 && (
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-foreground" style={{ width: `${Math.min(100, Math.round((recognition.usedThisMonth / recognition.cap) * 100))}%` }} />
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          Presença hoje: {today.entries} entradas ({today.presenceRate}%) · Eventos no mês: {data.eventsThisMonth.toLocaleString('pt-BR')}
          {data.lastEventAt ? ` · Último: ${new Date(data.lastEventAt).toLocaleString('pt-BR')}` : ''}
        </p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Contas admin — abrir tela como */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Administradores da escola</h3>
          <div className="space-y-2">
            {data.admins.length === 0 && <p className="text-xs text-muted-foreground">Nenhum admin.</p>}
            {data.admins.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name || a.email}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.email}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => impersonate(a.id, a.name || a.email)}>
                  <LogIn className="h-3.5 w-3.5 mr-1" /> Abrir como
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Dispositivos */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Dispositivos</h3>
          <div className="space-y-2">
            {data.devices.length === 0 && <p className="text-xs text-muted-foreground">Nenhum dispositivo.</p>}
            {data.devices.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                {d.status === 'ONLINE' ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                <span className="flex-1 truncate">{d.name}</span>
                <span className="text-[11px] text-muted-foreground">{d.lastSeen ? new Date(d.lastSeen).toLocaleDateString('pt-BR') : '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Responsáveis — abrir tela como */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Responsáveis ({data.parents.length})</h3>
        <div className="divide-y divide-border max-h-[360px] overflow-y-auto -mx-4">
          {data.parents.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 px-4 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name || p.user?.email}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {p.user?.email}{p.phone ? ` · ${p.phone}` : ''} · {p._count.students} aluno(s)
                </p>
              </div>
              {p.userId && (
                <Button variant="outline" size="sm" onClick={() => impersonate(p.userId, p.name || p.user?.email)}>
                  <LogIn className="h-3.5 w-3.5 mr-1" /> Abrir como
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Faturas */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Faturas recentes</h3>
        <div className="space-y-1.5">
          {data.invoices.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma fatura.</p>}
          {data.invoices.map((inv: any) => (
            <div key={inv.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{inv.description || 'Mensalidade'} · vence {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('pt-BR') : '—'}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium tabular-nums">{brl(inv.amount)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${inv.status === 'PAID' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{inv.status}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString('pt-BR')}</p>
    </Card>
  );
}
