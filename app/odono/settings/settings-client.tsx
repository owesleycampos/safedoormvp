'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, DollarSign, Users, Clock } from 'lucide-react';

interface PlatformSettings {
  id: string;
  defaultPlan: string;
  trialDays: number;
  essencialPrice: number;
  profissionalPrice: number;
  premiumPrice: number;
  annualDiscount: number;
  maxStudentsEssencial: number;
  maxStudentsProfissional: number;
  maxStudentsPremium: number;
}

function formatCurrency(cents: number) {
  return (cents / 100).toFixed(2);
}

export function SettingsClient({ settings }: { settings: PlatformSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    trialDays: settings.trialDays.toString(),
    essencialPrice: formatCurrency(settings.essencialPrice),
    profissionalPrice: formatCurrency(settings.profissionalPrice),
    premiumPrice: formatCurrency(settings.premiumPrice),
    annualDiscount: (settings.annualDiscount * 100).toString(),
    maxStudentsEssencial: settings.maxStudentsEssencial.toString(),
    maxStudentsProfissional: settings.maxStudentsProfissional.toString(),
    maxStudentsPremium: settings.maxStudentsPremium.toString(),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/odono/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: settings.id,
          trialDays: parseInt(form.trialDays),
          essencialPrice: Math.round(parseFloat(form.essencialPrice) * 100),
          profissionalPrice: Math.round(parseFloat(form.profissionalPrice) * 100),
          premiumPrice: Math.round(parseFloat(form.premiumPrice) * 100),
          annualDiscount: parseFloat(form.annualDiscount) / 100,
          maxStudentsEssencial: parseInt(form.maxStudentsEssencial),
          maxStudentsProfissional: parseInt(form.maxStudentsProfissional),
          maxStudentsPremium: parseInt(form.maxStudentsPremium),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold">Configurações da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">Preços, limites e regras globais</p>
      </div>

      {/* Pricing */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold">Preços dos Planos</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Essencial (R$/mês)</label>
              <input
                type="number"
                step="0.01"
                value={form.essencialPrice}
                onChange={(e) => setForm({ ...form, essencialPrice: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Profissional (R$/mês)</label>
              <input
                type="number"
                step="0.01"
                value={form.profissionalPrice}
                onChange={(e) => setForm({ ...form, profissionalPrice: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Premium (R$/mês)</label>
              <input
                type="number"
                step="0.01"
                value={form.premiumPrice}
                onChange={(e) => setForm({ ...form, premiumPrice: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="text-[10px] text-muted-foreground mt-1">0 = sob consulta</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Desconto Anual (%)</label>
            <input
              type="number"
              value={form.annualDiscount}
              onChange={(e) => setForm({ ...form, annualDiscount: e.target.value })}
              className="mt-1 w-full max-w-[200px] px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      </div>

      {/* Student Limits */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold">Limites de Alunos por Plano</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Essencial</label>
              <input
                type="number"
                value={form.maxStudentsEssencial}
                onChange={(e) => setForm({ ...form, maxStudentsEssencial: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Profissional</label>
              <input
                type="number"
                value={form.maxStudentsProfissional}
                onChange={(e) => setForm({ ...form, maxStudentsProfissional: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Premium</label>
              <input
                type="number"
                value={form.maxStudentsPremium}
                onChange={(e) => setForm({ ...form, maxStudentsPremium: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="text-[10px] text-muted-foreground mt-1">0 = ilimitado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trial */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold">Trial</h2>
        </div>
        <div className="p-4">
          <label className="text-xs font-medium text-muted-foreground">Dias de garantia/trial</label>
          <input
            type="number"
            value={form.trialDays}
            onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
            className="mt-1 w-full max-w-[200px] px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
