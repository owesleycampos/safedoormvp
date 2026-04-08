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
  ACTIVE: 'text-emerald-400 bg-emerald-400/10',
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
      await fetch('/api/odono/schools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, status: newStatus }),
      });
      router.refresh();
      setSelectedSchool(null);
    } finally {
      setActionLoading(false);
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
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
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
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      statusColors[school.status] || 'text-zinc-400 bg-zinc-400/10'
                    }`}>
                      {statusLabels[school.status] || school.status}
                    </span>
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
                    onClick={() => toggleSchoolStatus(selectedSchool.id, 'SUSPENDED')}
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
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
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
