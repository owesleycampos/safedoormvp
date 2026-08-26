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
  maxRecogEssencial: number;
  maxRecogProfissional: number;
  maxRecogPremium: number;
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
    maxRecogEssencial: (settings.maxRecogEssencial ?? 0).toString(),
    maxRecogProfissional: (settings.maxRecogProfissional ?? 0).toString(),
    maxRecogPremium: (settings.maxRecogPremium ?? 0).toString(),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    // Campos vazios viravam NaN → null → 500 no servidor, e o botão dizia
    // "Salvo!" mesmo assim. Valida antes e só comemora com res.ok.
    const nums = {
      trialDays: parseInt(form.trialDays),
      essencialPrice: Math.round(parseFloat(form.essencialPrice) * 100),
      profissionalPrice: Math.round(parseFloat(form.profissionalPrice) * 100),
      premiumPrice: Math.round(parseFloat(form.premiumPrice) * 100),
      annualDiscount: parseFloat(form.annualDiscount) / 100,
      maxStudentsEssencial: parseInt(form.maxStudentsEssencial),
      maxStudentsProfissional: parseInt(form.maxStudentsProfissional),
      maxStudentsPremium: parseInt(form.maxStudentsPremium),
      maxRecogEssencial: parseInt(form.maxRecogEssencial),
      maxRecogProfissional: parseInt(form.maxRecogProfissional),
      maxRecogPremium: parseInt(form.maxRecogPremium),
    };
    if (Object.values(nums).some((v) => Number.isNaN(v))) {
      alert('Preencha todos os campos com números válidos.');
      return;
    }
    if (nums.trialDays < 0 || nums.trialDays > 90) { alert('Trial deve ter entre 0 e 90 dias.'); return; }
    if (nums.annualDiscount < 0 || nums.annualDiscount > 0.9) { alert('Desconto anual deve estar entre 0% e 90%.'); return; }
    if (nums.essencialPrice < 0 || nums.profissionalPrice < 0 || nums.premiumPrice < 0) { alert('Preços não podem ser negativos.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/hq/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: settings.id, ...nums }),
      }).catch(() => null);
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => null);
        alert(d?.error || 'Falha ao salvar as configurações.');
        return;
      }
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
          <DollarSign className="h-4 w-4 text-success" />
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
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Profissional (R$/mês)</label>
              <input
                type="number"
                step="0.01"
                value={form.profissionalPrice}
                onChange={(e) => setForm({ ...form, profissionalPrice: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Premium (R$/mês)</label>
              <input
                type="number"
                step="0.01"
                value={form.premiumPrice}
                onChange={(e) => setForm({ ...form, premiumPrice: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25"
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
              className="mt-1 w-full max-w-[200px] px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25"
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
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Profissional</label>
              <input
                type="number"
                value={form.maxStudentsProfissional}
                onChange={(e) => setForm({ ...form, maxStudentsProfissional: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Premium</label>
              <input
                type="number"
                value={form.maxStudentsPremium}
                onChange={(e) => setForm({ ...form, maxStudentsPremium: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
              <p className="text-[10px] text-muted-foreground mt-1">0 = ilimitado</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Cota mensal de reconhecimentos (0 = ilimitado)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Essencial</label>
                <input type="number" value={form.maxRecogEssencial}
                  onChange={(e) => setForm({ ...form, maxRecogEssencial: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Profissional</label>
                <input type="number" value={form.maxRecogProfissional}
                  onChange={(e) => setForm({ ...form, maxRecogProfissional: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Premium</label>
                <input type="number" value={form.maxRecogPremium}
                  onChange={(e) => setForm({ ...form, maxRecogPremium: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25" />
              </div>
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
            className="mt-1 w-full max-w-[200px] px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25"
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-colors disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
