'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign, TrendingUp, AlertTriangle, Clock,
  CreditCard, Receipt, Search, CheckCircle, XCircle,
  Plus,
} from 'lucide-react';

interface BillingData {
  mrr: number;
  arr: number;
  paidThisMonth: number;
  overdueCount: number;
  overdueAmount: number;
  pendingCount: number;
  subscriptions: {
    id: string;
    schoolId: string;
    schoolName: string;
    schoolStatus: string;
    plan: string;
    billing: string;
    status: string;
    priceMonthly: number;
    discount: number;
    startsAt: string;
    endsAt: string | null;
    trialEndsAt: string | null;
  }[];
  invoices: {
    id: string;
    schoolName: string;
    amount: number;
    status: string;
    dueDate: string;
    paidAt: string | null;
    paymentMethod: string | null;
    description: string | null;
  }[];
  settings: {
    essencialPrice: number;
    profissionalPrice: number;
    premiumPrice: number;
    annualDiscount: number;
    trialDays: number;
  } | null;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

const invoiceStatusColors: Record<string, string> = {
  PAID: 'text-emerald-400 bg-emerald-400/10',
  PENDING: 'text-amber-400 bg-amber-400/10',
  OVERDUE: 'text-red-400 bg-red-400/10',
  CANCELLED: 'text-zinc-400 bg-zinc-400/10',
};

const invoiceStatusLabels: Record<string, string> = {
  PAID: 'Pago',
  PENDING: 'Pendente',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
};

const subStatusColors: Record<string, string> = {
  ACTIVE: 'text-emerald-400 bg-emerald-400/10',
  TRIAL: 'text-blue-400 bg-blue-400/10',
  PAST_DUE: 'text-amber-400 bg-amber-400/10',
  CANCELLED: 'text-zinc-400 bg-zinc-400/10',
};

const subStatusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  TRIAL: 'Trial',
  PAST_DUE: 'Inadimplente',
  CANCELLED: 'Cancelado',
};

export function BillingClient({ data }: { data: BillingData }) {
  const router = useRouter();
  const [tab, setTab] = useState<'subscriptions' | 'invoices'>('subscriptions');
  const [search, setSearch] = useState('');
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    schoolId: '',
    amount: '',
    dueDate: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const filteredSubs = data.subscriptions.filter((s) =>
    s.schoolName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredInvoices = data.invoices.filter((i) =>
    i.schoolName.toLowerCase().includes(search.toLowerCase())
  );

  async function markInvoicePaid(invoiceId: string) {
    await fetch('/api/odono/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, status: 'PAID', paidAt: new Date().toISOString() }),
    });
    router.refresh();
  }

  async function createInvoice() {
    if (!invoiceForm.schoolId || !invoiceForm.amount || !invoiceForm.dueDate) return;
    setSaving(true);
    try {
      await fetch('/api/odono/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: invoiceForm.schoolId,
          amount: Math.round(parseFloat(invoiceForm.amount) * 100),
          dueDate: invoiceForm.dueDate,
          description: invoiceForm.description,
        }),
      });
      router.refresh();
      setShowAddInvoice(false);
      setInvoiceForm({ schoolId: '', amount: '', dueDate: '', description: '' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold">Faturamento</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de assinaturas e cobranças</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <DollarSign className="h-3.5 w-3.5" /> MRR
          </div>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(data.mrr)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">ARR: {formatCurrency(data.arr)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <TrendingUp className="h-3.5 w-3.5" /> Recebido/Mês
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.paidThisMonth)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Vencidos
          </div>
          <p className="text-xl font-bold text-red-400">{data.overdueCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{formatCurrency(data.overdueAmount)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Clock className="h-3.5 w-3.5" /> Pendentes
          </div>
          <p className="text-xl font-bold text-amber-400">{data.pendingCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        <button
          onClick={() => setTab('subscriptions')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'subscriptions' ? 'border-emerald-400 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CreditCard className="h-4 w-4 inline mr-1.5" />
          Assinaturas ({data.subscriptions.length})
        </button>
        <button
          onClick={() => setTab('invoices')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'invoices' ? 'border-emerald-400 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Receipt className="h-4 w-4 inline mr-1.5" />
          Faturas ({data.invoices.length})
        </button>
      </div>

      {/* Search + Actions */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar escola..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        {tab === 'invoices' && (
          <button
            onClick={() => setShowAddInvoice(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Fatura
          </button>
        )}
      </div>

      {/* Subscriptions Tab */}
      {tab === 'subscriptions' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Escola</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Plano</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Cobrança</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor/Mês</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Início</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSubs.map((sub) => {
                  const effective = sub.billing === 'ANNUAL'
                    ? Math.round(sub.priceMonthly * (1 - sub.discount))
                    : sub.priceMonthly;
                  return (
                    <tr key={sub.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{sub.schoolName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">{sub.plan}</span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell text-muted-foreground">
                        {sub.billing === 'ANNUAL' ? 'Anual' : 'Mensal'}
                        {sub.discount > 0 && (
                          <span className="ml-1 text-emerald-400 text-[10px]">-{Math.round(sub.discount * 100)}%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(effective)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          subStatusColors[sub.status] || ''
                        }`}>
                          {subStatusLabels[sub.status] || sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground hidden lg:table-cell">
                        {formatDate(sub.startsAt)}
                      </td>
                    </tr>
                  );
                })}
                {filteredSubs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma assinatura encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Escola</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Descrição</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{inv.schoolName}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                      {inv.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv.amount)}</td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        invoiceStatusColors[inv.status] || ''
                      }`}>
                        {invoiceStatusLabels[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                        <button
                          onClick={() => markInvoicePaid(inv.id)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-emerald-500/10 transition-colors"
                          title="Marcar como pago"
                        >
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma fatura encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Invoice Modal */}
      {showAddInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAddInvoice(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border">
              <h2 className="text-lg font-bold">Nova Fatura</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Escola</label>
                <select
                  value={invoiceForm.schoolId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, schoolId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Selecionar escola...</option>
                  {data.subscriptions.map((s) => (
                    <option key={s.schoolId} value={s.schoolId}>{s.schoolName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="497.00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
                <input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <input
                  type="text"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Mensalidade Abril/2026"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={createInvoice}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Criar Fatura'}
                </button>
                <button
                  onClick={() => setShowAddInvoice(false)}
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
