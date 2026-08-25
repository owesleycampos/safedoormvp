'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  School, Search, Filter, MoreHorizontal, Eye, Ban, CheckCircle,
  Users, GraduationCap, Layers, Smartphone, Cloud, MapPin,
  Mail, Phone, CreditCard, Plus,
} from 'lucide-react';

interface SchoolData {
  id: string;
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  students: number;
  admins: number;
  classes: number;
  devices: number;
  plan: string | null;
  subStatus: string | null;
  billing: string | null;
  priceMonthly: number | null;
  awsLabel: string | null;
  awsAccountId: string | null;
  notes: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'text-success bg-success/10',
  TRIAL: 'text-blue-400 bg-blue-400/10',
  SUSPENDED: 'text-red-400 bg-red-400/10',
  CANCELLED: 'text-zinc-400 bg-zinc-400/10',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  TRIAL: 'Trial',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function SchoolsClient({ schools }: { schools: SchoolData[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState<SchoolData | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '', cnpj: '', city: '', state: '',
    contactEmail: '', contactPhone: '',
    plan: 'ESSENCIAL', billing: 'MONTHLY',
    adminName: '', adminEmail: '', adminPassword: '',
  });

  const filtered = schools.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.cnpj?.includes(search) ||
      s.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function toggleSchoolStatus(schoolId: string, newStatus: string) {
    setActionLoading(true);
    try {
      const res = await fetch('/api/odono/schools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, status: newStatus }),
      });
      if (!res.ok) {
        // Antes o try/finally não tinha catch nem checava o status: uma
        // sessão expirada fechava o modal e o dono achava que suspendeu.
        const data = await res.json().catch(() => null);
        alert(data?.error || 'A alteração falhou. Recarregue a página e tente novamente.');
        return;
      }
      router.refresh();
      setSelectedSchool(null);
      setConfirmSuspend(null);
    } catch {
      alert('Sem conexão com o servidor. A escola NÃO foi alterada.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateSchool(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.name.trim() || !createForm.adminEmail.trim() || createForm.adminPassword.length < 8) {
      setCreateError('Preencha nome da escola, e-mail do admin e uma senha de ao menos 8 caracteres.');
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch('/api/odono/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          cnpj: createForm.cnpj || null,
          city: createForm.city || null,
          state: createForm.state || null,
          contactEmail: createForm.contactEmail || null,
          contactPhone: createForm.contactPhone || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateError(data?.error || 'Não foi possível criar a escola.');
        return;
      }
      setCreateOpen(false);
      setCreateForm({
        name: '', cnpj: '', city: '', state: '',
        contactEmail: '', contactPhone: '',
        plan: 'ESSENCIAL', billing: 'MONTHLY',
        adminName: '', adminEmail: '', adminPassword: '',
      });
      router.refresh();
    } catch {
      setCreateError('Sem conexão com o servidor.');
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Escolas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {schools.length} escola(s) cadastrada(s)
          </p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); setCreateError(null); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Escola
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'border-foreground bg-foreground/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {s === 'ALL' ? 'Todos' : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Escola</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Localização</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Alunos</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Plano</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">AWS</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((school) => (
                <tr key={school.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{school.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {school.cnpj || 'Sem CNPJ'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs">{school.city || '—'}{school.state ? `, ${school.state}` : ''}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium">{school.students}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {school.plan || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {school.awsLabel || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        statusColors[school.status] || 'text-zinc-400 bg-zinc-400/10'
                      }`}>
                        {statusLabels[school.status] || school.status}
                      </span>
                      {/* subStatus era carregado do banco e nunca exibido:
                          inadimplente aparecia com badge verde "Ativo". */}
                      {school.subStatus === 'PAST_DUE' && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-amber-400 bg-amber-400/10">
                          Inadimplente
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedSchool(school)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma escola encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedSchool(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{selectedSchool.name}</h2>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  statusColors[selectedSchool.status] || ''
                }`}>
                  {statusLabels[selectedSchool.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{selectedSchool.cnpj || 'Sem CNPJ'}</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                <StatMini icon={GraduationCap} label="Alunos" value={selectedSchool.students} />
                <StatMini icon={Users} label="Admins" value={selectedSchool.admins} />
                <StatMini icon={Layers} label="Turmas" value={selectedSchool.classes} />
                <StatMini icon={Smartphone} label="Devices" value={selectedSchool.devices} />
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                {selectedSchool.city && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedSchool.city}{selectedSchool.state ? `, ${selectedSchool.state}` : ''}
                  </div>
                )}
                {selectedSchool.contactEmail && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {selectedSchool.contactEmail}
                  </div>
                )}
                {selectedSchool.contactPhone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {selectedSchool.contactPhone}
                  </div>
                )}
                {selectedSchool.plan && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    Plano {selectedSchool.plan}
                    {selectedSchool.priceMonthly && ` · ${formatCurrency(selectedSchool.priceMonthly)}/mês`}
                    {selectedSchool.billing && ` · ${selectedSchool.billing === 'ANNUAL' ? 'Anual' : 'Mensal'}`}
                  </div>
                )}
                {selectedSchool.awsLabel && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Cloud className="h-3.5 w-3.5" />
                    AWS: {selectedSchool.awsLabel}
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedSchool.notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Notas</p>
                  <p className="text-sm">{selectedSchool.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {selectedSchool.status === 'ACTIVE' && (
                  <button
                    onClick={() => setConfirmSuspend(selectedSchool)}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" />
                    Suspender
                  </button>
                )}
                {selectedSchool.status === 'SUSPENDED' && (
                  <button
                    onClick={() => toggleSchoolStatus(selectedSchool.id, 'ACTIVE')}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Reativar
                  </button>
                )}
                <button
                  onClick={() => setSelectedSchool(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirmação de suspensão — antes um clique derrubava todos os admins
          do cliente sem barreira nenhuma, enquanto excluir uma turma exigia
          confirm(). */}
      {confirmSuspend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmSuspend(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Ban className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Suspender {confirmSuspend.name}?</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos os administradores da escola serão desconectados e o painel deles
                  ficará bloqueado até a reativação. Os dados são preservados.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmSuspend(null)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => toggleSchoolStatus(confirmSuspend.id, 'SUSPENDED')}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Suspendendo...' : 'Suspender escola'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nova escola — a API transacional existia completa e nenhuma tela a
          chamava; onboardar cliente exigia curl. */}
      {createOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setCreateOpen(false)}>
          <form
            onSubmit={handleCreateSchool}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border">
              <h2 className="text-lg font-bold">Nova Escola</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Cria a escola, a assinatura e a conta do administrador de uma vez.
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Escola</p>
                <input
                  placeholder="Nome da escola *"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="CNPJ"
                    value={createForm.cnpj}
                    onChange={(e) => setCreateForm((f) => ({ ...f, cnpj: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  />
                  <input
                    placeholder="Telefone"
                    value={createForm.contactPhone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, contactPhone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  />
                  <input
                    placeholder="Cidade"
                    value={createForm.city}
                    onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  />
                  <input
                    placeholder="UF"
                    maxLength={2}
                    value={createForm.state}
                    onChange={(e) => setCreateForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  />
                </div>
                <input
                  type="email"
                  placeholder="E-mail de contato da escola"
                  value={createForm.contactEmail}
                  onChange={(e) => setCreateForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                />
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Plano</p>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={createForm.plan}
                    onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  >
                    <option value="ESSENCIAL">Essencial</option>
                    <option value="PROFISSIONAL">Profissional</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                  <select
                    value={createForm.billing}
                    onChange={(e) => setCreateForm((f) => ({ ...f, billing: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  >
                    <option value="MONTHLY">Mensal</option>
                    <option value="ANNUAL">Anual (com desconto)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Administrador da escola</p>
                <input
                  placeholder="Nome do administrador"
                  value={createForm.adminName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, adminName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    placeholder="E-mail de acesso *"
                    value={createForm.adminEmail}
                    onChange={(e) => setCreateForm((f) => ({ ...f, adminEmail: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  />
                  <input
                    type="password"
                    placeholder="Senha inicial (mín. 8) *"
                    value={createForm.adminPassword}
                    onChange={(e) => setCreateForm((f) => ({ ...f, adminPassword: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40"
                  />
                </div>
              </div>

              {createError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                  {createError}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border flex gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={createLoading}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createLoading}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {createLoading ? 'Criando...' : 'Criar escola'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatMini({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/50">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
