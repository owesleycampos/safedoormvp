'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cloud, Server, AlertTriangle, CheckCircle, Plus,
  School, Users, DollarSign, MapPin, RefreshCw,
  Settings, Trash2, ArrowRight,
} from 'lucide-react';

interface AwsData {
  accounts: {
    id: string;
    label: string;
    accountId: string;
    region: string;
    status: string;
    maxCollections: number;
    usedCollections: number;
    maxFacesPerCol: number;
    monthlyBudget: number | null;
    currentSpend: number;
    lastSyncAt: string | null;
    notes: string | null;
    schools: { id: string; name: string; students: number }[];
  }[];
  unassignedSchools: { id: string; name: string }[];
}

const statusColors: Record<string, string> = {
  ACTIVE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  LIMIT_NEAR: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  LIMIT_REACHED: 'text-red-400 bg-red-400/10 border-red-400/30',
  DISABLED: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  LIMIT_NEAR: 'Limite Próximo',
  LIMIT_REACHED: 'Limite Atingido',
  DISABLED: 'Desativado',
};

export function AwsClient({ data }: { data: AwsData }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    label: '',
    accountId: '',
    region: 'us-east-1',
    maxCollections: '100',
    monthlyBudget: '',
  });
  const [saving, setSaving] = useState(false);

  const totalCollections = data.accounts.reduce((a, c) => a + c.usedCollections, 0);
  const totalMax = data.accounts.reduce((a, c) => a + c.maxCollections, 0);
  const totalSpend = data.accounts.reduce((a, c) => a + c.currentSpend, 0);
  const totalBudget = data.accounts.reduce((a, c) => a + (c.monthlyBudget || 0), 0);

  async function addAccount() {
    if (!form.label || !form.accountId) return;
    setSaving(true);
    try {
      await fetch('/api/odono/aws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          maxCollections: parseInt(form.maxCollections),
          monthlyBudget: form.monthlyBudget ? parseFloat(form.monthlyBudget) : null,
        }),
      });
      router.refresh();
      setShowAdd(false);
      setForm({ label: '', accountId: '', region: 'us-east-1', maxCollections: '100', monthlyBudget: '' });
    } finally {
      setSaving(false);
    }
  }

  async function assignSchool(awsAccountId: string, schoolId: string) {
    await fetch('/api/odono/aws', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign-school', awsAccountId, schoolId }),
    });
    router.refresh();
  }

  async function toggleStatus(accountId: string, newStatus: string) {
    await fetch('/api/odono/aws', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-status', accountId, status: newStatus }),
    });
    router.refresh();
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Contas AWS</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciamento de contas Rekognition e contingência</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Conta
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Server className="h-3.5 w-3.5" /> Contas
          </div>
          <p className="text-xl font-bold">{data.accounts.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Cloud className="h-3.5 w-3.5" /> Collections
          </div>
          <p className="text-xl font-bold">{totalCollections}/{totalMax}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <DollarSign className="h-3.5 w-3.5" /> Gasto/Mês
          </div>
          <p className="text-xl font-bold">${totalSpend.toFixed(2)}</p>
          {totalBudget > 0 && (
            <p className="text-[11px] text-muted-foreground">Budget: ${totalBudget.toFixed(2)}</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <School className="h-3.5 w-3.5" /> Sem Conta
          </div>
          <p className="text-xl font-bold text-amber-400">{data.unassignedSchools.length}</p>
        </div>
      </div>

      {/* Account Cards */}
      <div className="space-y-4">
        {data.accounts.map((acc) => {
          const pct = acc.maxCollections > 0
            ? Math.round((acc.usedCollections / acc.maxCollections) * 100)
            : 0;
          const spendPct = acc.monthlyBudget
            ? Math.round((acc.currentSpend / acc.monthlyBudget) * 100)
            : 0;

          return (
            <div key={acc.id} className={`rounded-xl border bg-card overflow-hidden ${
              acc.status === 'LIMIT_REACHED' ? 'border-red-400/30' :
              acc.status === 'LIMIT_NEAR' ? 'border-amber-400/30' : 'border-border'
            }`}>
              {/* Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    statusColors[acc.status]?.split(' ').slice(1, 3).join(' ') || 'bg-zinc-400/10'
                  }`}>
                    <Cloud className={`h-5 w-5 ${statusColors[acc.status]?.split(' ')[0] || ''}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{acc.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {acc.accountId} · {acc.region}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    statusColors[acc.status] || ''
                  }`}>
                    {statusLabels[acc.status]}
                  </span>
                  {acc.status === 'ACTIVE' ? (
                    <button
                      onClick={() => toggleStatus(acc.id, 'DISABLED')}
                      className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-500/10 transition-colors"
                      title="Desativar"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  ) : acc.status === 'DISABLED' ? (
                    <button
                      onClick={() => toggleStatus(acc.id, 'ACTIVE')}
                      className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-emerald-500/10 transition-colors"
                      title="Reativar"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Meters */}
              <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Collections</span>
                    <span>{acc.usedCollections}/{acc.maxCollections} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
                {acc.monthlyBudget && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Budget</span>
                      <span>${acc.currentSpend.toFixed(2)} / ${acc.monthlyBudget.toFixed(2)} ({spendPct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${
                        spendPct > 80 ? 'bg-red-400' : spendPct > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} style={{ width: `${Math.min(spendPct, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Schools */}
              <div className="border-t border-border px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Escolas ({acc.schools.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {acc.schools.map((s) => (
                    <span key={s.id} className="text-xs bg-muted px-2 py-1 rounded-md flex items-center gap-1">
                      <School className="h-3 w-3 text-muted-foreground" />
                      {s.name}
                      <span className="text-muted-foreground">({s.students})</span>
                    </span>
                  ))}
                  {acc.schools.length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhuma escola atribuída</span>
                  )}
                </div>
              </div>

              {/* Assign School */}
              {data.unassignedSchools.length > 0 && acc.status === 'ACTIVE' && (
                <div className="border-t border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border bg-background"
                      onChange={(e) => {
                        if (e.target.value) assignSchool(acc.id, e.target.value);
                        e.target.value = '';
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Atribuir escola...</option>
                      {data.unassignedSchools.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* Notes */}
              {acc.notes && (
                <div className="border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">{acc.notes}</p>
                </div>
              )}

              {/* Last Sync */}
              {acc.lastSyncAt && (
                <div className="border-t border-border px-4 py-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  Último sync: {new Date(acc.lastSyncAt).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          );
        })}

        {data.accounts.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Cloud className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma conta AWS configurada.</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione uma conta para começar.</p>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border">
              <h2 className="text-lg font-bold">Nova Conta AWS</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome/Label</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Principal, Contingência 1..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">AWS Account ID</label>
                <input
                  type="text"
                  value={form.accountId}
                  onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="123456789012"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Região</label>
                  <select
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                  >
                    <option>us-east-1</option>
                    <option>us-west-2</option>
                    <option>sa-east-1</option>
                    <option>eu-west-1</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Max Collections</label>
                  <input
                    type="number"
                    value={form.maxCollections}
                    onChange={(e) => setForm({ ...form, maxCollections: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Budget Mensal (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.monthlyBudget}
                  onChange={(e) => setForm({ ...form, monthlyBudget: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="50.00"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={addAccount}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Adicionar'}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
