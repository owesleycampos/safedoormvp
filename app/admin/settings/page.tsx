'use client';

import { useState, useEffect } from 'react';
import {
  School, Phone, Mail, MapPin, Clock, Bell, Sliders, Save,
  Loader2, CheckCircle2, Shield, Globe, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AdminHeader } from '@/components/admin/header';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SchoolForm {
  name: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone: string;
}

interface SettingsForm {
  entryStartTime: string;
  entryEndTime: string;
  exitStartTime: string;
  exitEndTime: string;
  minConfidence: number;
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
  timezone: string;
}

const INITIAL_SCHOOL: SchoolForm = {
  name: '',
  cnpj: '',
  address: '',
  city: '',
  state: '',
  contactEmail: '',
  contactPhone: '',
};

const INITIAL_SETTINGS: SettingsForm = {
  entryStartTime: '06:00',
  entryEndTime: '09:00',
  exitStartTime: '11:00',
  exitEndTime: '18:00',
  minConfidence: 0.9,
  notifyOnEntry: true,
  notifyOnExit: true,
  timezone: 'America/Sao_Paulo',
};

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Belem', label: 'Belém (UTC-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
  { value: 'America/Recife', label: 'Recife (UTC-3)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (UTC-4)' },
  { value: 'America/Boa_Vista', label: 'Boa Vista (UTC-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC-4)' },
  { value: 'America/Campo_Grande', label: 'Campo Grande (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
];

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

// ─── Confidence slider ────────────────────────────────────────────────────────

function ConfidenceSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 90 ? 'text-success' : pct >= 75 ? 'text-warn' : 'text-destructive';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Confiança mínima de reconhecimento</Label>
        <span className={cn('text-lg font-bold tabular-nums', color)}>{pct}%</span>
      </div>
      <input
        type="range"
        min={50}
        max={99}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, hsl(var(--foreground)) 0%, hsl(var(--foreground)) ${((pct - 50) / 49) * 100}%, rgba(99,99,102,0.3) ${((pct - 50) / 49) * 100}%, rgba(99,99,102,0.3) 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>50% (mais permissivo)</span>
        <span>99% (mais restritivo)</span>
      </div>
      <div
        className={cn(
          'rounded-md p-3 text-xs',
          pct >= 90
            ? 'bg-success/10 text-success border border-success/20'
            : pct >= 75
            ? 'bg-warn/10 text-warn border border-warn/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        )}
      >
        {pct >= 90 && (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Alta segurança — recomendado para uso em produção.
          </span>
        )}
        {pct >= 75 && pct < 90 && (
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Segurança moderada — pode haver falsos positivos.
          </span>
        )}
        {pct < 75 && (
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Baixa segurança — não recomendado para produção.
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [school, setSchool] = useState<SchoolForm>(INITIAL_SCHOOL);
  const [settings, setSettings] = useState<SettingsForm>(INITIAL_SETTINGS);
  const [loadingSchool, setLoadingSchool] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('school');

  useEffect(() => {
    async function load() {
      try {
        const [schoolRes, settingsRes] = await Promise.all([
          fetch('/api/school'),
          fetch('/api/school/settings'),
        ]);
        if (schoolRes.ok) {
          const data = await schoolRes.json();
          setSchool({
            name: data.name ?? '',
            cnpj: data.cnpj ?? '',
            address: data.address ?? '',
            city: data.city ?? '',
            state: data.state ?? '',
            contactEmail: data.contactEmail ?? '',
            contactPhone: data.contactPhone ?? '',
          });
        }
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSettings({
            entryStartTime: data.entryStartTime ?? '06:00',
            entryEndTime: data.entryEndTime ?? '09:00',
            exitStartTime: data.exitStartTime ?? '11:00',
            exitEndTime: data.exitEndTime ?? '18:00',
            minConfidence: data.minConfidence ?? 0.9,
            notifyOnEntry: data.notifyOnEntry ?? true,
            notifyOnExit: data.notifyOnExit ?? true,
            timezone: data.timezone ?? 'America/Sao_Paulo',
          });
        }
      } catch {
        // Use defaults if API not ready
      } finally {
        setFetchLoading(false);
      }
    }
    load();
  }, []);

  async function saveSchool(e: React.FormEvent) {
    e.preventDefault();
    setLoadingSchool(true);
    try {
      const res = await fetch('/api/school', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(school),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ variant: 'success', title: 'Escola atualizada', description: 'Dados salvos com sucesso.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message });
    } finally {
      setLoadingSchool(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/school/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ variant: 'success', title: 'Configurações salvas', description: 'Preferências atualizadas.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message });
    } finally {
      setLoadingSettings(false);
    }
  }

  const navItems = [
    { id: 'school', label: 'Dados da escola', icon: School },
    { id: 'schedule', label: 'Horários', icon: Clock },
    { id: 'recognition', label: 'Reconhecimento', icon: Shield },
    { id: 'notifications', label: 'Notificações', icon: Bell },
  ];

  if (fetchLoading) {
    return (
      <div className="flex flex-col flex-1 page-enter">
        <AdminHeader title="Configurações" subtitle="Configurações da escola e do sistema" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 page-enter">
      <AdminHeader title="Configurações" subtitle="Gerencie os dados e preferências da escola" />

      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto flex gap-8">
          {/* Sidebar nav */}
          <nav className="w-52 shrink-0 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left',
                    activeSection === item.id
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* School data */}
            {activeSection === 'school' && (
              <form onSubmit={saveSchool}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <School className="h-5 w-5 text-foreground" />
                      Dados da Escola
                    </CardTitle>
                    <CardDescription>
                      Informações institucionais exibidas nos relatórios e comunicados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="school-name">Nome da escola *</Label>
                      <Input
                        id="school-name"
                        placeholder="Ex: Escola Municipal João da Silva"
                        value={school.name}
                        onChange={(e) => setSchool((s) => ({ ...s, name: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="school-cnpj">CNPJ</Label>
                      <Input
                        id="school-cnpj"
                        placeholder="00.000.000/0000-00"
                        value={school.cnpj}
                        onChange={(e) => setSchool((s) => ({ ...s, cnpj: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="school-address">Endereço</Label>
                      <Input
                        id="school-address"
                        placeholder="Rua, número, bairro"
                        value={school.address}
                        onChange={(e) => setSchool((s) => ({ ...s, address: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="school-city">Cidade</Label>
                        <Input
                          id="school-city"
                          placeholder="São Paulo"
                          value={school.city}
                          onChange={(e) => setSchool((s) => ({ ...s, city: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="school-state">Estado</Label>
                        <select
                          id="school-state"
                          value={school.state}
                          onChange={(e) => setSchool((s) => ({ ...s, state: e.target.value }))}
                          className="w-full h-11 rounded-md border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                        >
                          <option value="">Selecionar...</option>
                          {BR_STATES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="school-email">E-mail de contato</Label>
                        <Input
                          id="school-email"
                          type="email"
                          placeholder="contato@escola.edu.br"
                          leftIcon={<Mail className="h-4 w-4" />}
                          value={school.contactEmail}
                          onChange={(e) => setSchool((s) => ({ ...s, contactEmail: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="school-phone">Telefone</Label>
                        <Input
                          id="school-phone"
                          placeholder="(11) 0000-0000"
                          leftIcon={<Phone className="h-4 w-4" />}
                          value={school.contactPhone}
                          onChange={(e) => setSchool((s) => ({ ...s, contactPhone: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" loading={loadingSchool}>
                        <Save className="h-4 w-4" />
                        Salvar dados
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            )}

            {/* Schedule */}
            {activeSection === 'schedule' && (
              <form onSubmit={saveSettings}>
                <div className="space-y-5">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-foreground" />
                        Horários de Entrada e Saída
                      </CardTitle>
                      <CardDescription>
                        Define as janelas de tempo em que eventos de entrada e saída são aceitos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Entry times */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="h-2.5 w-2.5 rounded-full bg-success" />
                          <p className="text-sm font-semibold">Janela de Entrada</p>
                          <Badge variant="entry">ENTRY</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="entry-start">Início</Label>
                            <Input
                              id="entry-start"
                              type="time"
                              value={settings.entryStartTime}
                              onChange={(e) => setSettings((s) => ({ ...s, entryStartTime: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="entry-end">Fim</Label>
                            <Input
                              id="entry-end"
                              type="time"
                              value={settings.entryEndTime}
                              onChange={(e) => setSettings((s) => ({ ...s, entryEndTime: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-border/50" />

                      {/* Exit times */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                          <p className="text-sm font-semibold">Janela de Saída</p>
                          <Badge variant="exit">EXIT</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="exit-start">Início</Label>
                            <Input
                              id="exit-start"
                              type="time"
                              value={settings.exitStartTime}
                              onChange={(e) => setSettings((s) => ({ ...s, exitStartTime: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="exit-end">Fim</Label>
                            <Input
                              id="exit-end"
                              type="time"
                              value={settings.exitEndTime}
                              onChange={(e) => setSettings((s) => ({ ...s, exitEndTime: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-foreground" />
                        Fuso horário
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Fuso horário da escola</Label>
                        <select
                          id="timezone"
                          value={settings.timezone}
                          onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
                          className="w-full h-11 rounded-md border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button type="submit" loading={loadingSettings}>
                      <Save className="h-4 w-4" />
                      Salvar horários
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Recognition */}
            {activeSection === 'recognition' && (
              <form onSubmit={saveSettings}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-foreground" />
                      Reconhecimento Facial
                    </CardTitle>
                    <CardDescription>
                      Ajuste a sensibilidade do sistema de reconhecimento facial.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ConfidenceSlider
                      value={settings.minConfidence}
                      onChange={(v) => setSettings((s) => ({ ...s, minConfidence: v }))}
                    />

                    <div className="rounded-md bg-secondary/50 p-4 space-y-2">
                      <p className="text-sm font-semibold">Como funciona?</p>
                      <p className="text-sm text-muted-foreground">
                        Quando o sistema detecta um rosto, ele compara com os dados cadastrados e
                        retorna um nível de confiança (0–100%). Rostos com confiança abaixo do
                        mínimo configurado são registrados como <strong>não identificados</strong>
                        {' '}e ficam disponíveis para revisão manual.
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" loading={loadingSettings}>
                        <Save className="h-4 w-4" />
                        Salvar configurações
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <form onSubmit={saveSettings}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-foreground" />
                      Notificações Push
                    </CardTitle>
                    <CardDescription>
                      Configure quais eventos disparam notificações para os responsáveis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Notify on entry */}
                    <div className="flex items-center justify-between rounded-md bg-secondary/40 px-4 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-success shrink-0" />
                          <p className="text-sm font-semibold">Notificar na entrada</p>
                        </div>
                        <p className="text-xs text-muted-foreground pl-4">
                          Envia push ao responsável quando o aluno entra na escola.
                        </p>
                      </div>
                      <Switch
                        checked={settings.notifyOnEntry}
                        onCheckedChange={(checked) =>
                          setSettings((s) => ({ ...s, notifyOnEntry: checked }))
                        }
                      />
                    </div>

                    {/* Notify on exit */}
                    <div className="flex items-center justify-between rounded-md bg-secondary/40 px-4 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                          <p className="text-sm font-semibold">Notificar na saída</p>
                        </div>
                        <p className="text-xs text-muted-foreground pl-4">
                          Envia push ao responsável quando o aluno sai da escola.
                        </p>
                      </div>
                      <Switch
                        checked={settings.notifyOnExit}
                        onCheckedChange={(checked) =>
                          setSettings((s) => ({ ...s, notifyOnExit: checked }))
                        }
                      />
                    </div>

                    {/* Info box */}
                    <div className="rounded-md bg-secondary border border-border p-4">
                      <p className="text-xs text-foreground">
                        As notificações são enviadas via Web Push (PWA) para os responsáveis
                        que autorizaram o recebimento no aplicativo. Certifique-se de que as
                        chaves VAPID estão configuradas nas variáveis de ambiente.
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" loading={loadingSettings}>
                        <Save className="h-4 w-4" />
                        Salvar notificações
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
