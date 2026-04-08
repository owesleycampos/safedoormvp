'use client';

import {
  School, Users, GraduationCap, Activity, DollarSign,
  TrendingUp, Cloud, ArrowUpRight, ArrowDownRight, Clock,
  CreditCard, AlertTriangle,
} from 'lucide-react';

interface DashboardData {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalParents: number;
  totalEvents: number;
  eventsThisMonth: number;
  eventsGrowth: number;
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  recentSchools: {
    id: string;
    name: string;
    status: string;
    students: number;
    admins: number;
    plan: string | null;
    subStatus: string | null;
    createdAt: string;
  }[];
  recentLogs: {
    id: string;
    action: string;
    entityType: string | null;
    createdAt: string;
    metadata: string | null;
  }[];
  awsAccounts: {
    id: string;
    label: string;
    status: string;
    usedCollections: number;
    maxCollections: number;
    currentSpend: number;
    monthlyBudget: number | null;
  }[];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusColors: Record<string, string> = {
  ACTIVE: 'text-emerald-400 bg-emerald-400/10',
  TRIAL: 'text-blue-400 bg-blue-400/10',
  SUSPENDED: 'text-red-400 bg-red-400/10',
  CANCELLED: 'text-zinc-400 bg-zinc-400/10',
  PAST_DUE: 'text-amber-400 bg-amber-400/10',
  LIMIT_NEAR: 'text-amber-400 bg-amber-400/10',
  LIMIT_REACHED: 'text-red-400 bg-red-400/10',
  DISABLED: 'text-zinc-400 bg-zinc-400/10',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  TRIAL: 'Trial',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
  PAST_DUE: 'Inadimplente',
  LIMIT_NEAR: 'Limite Próximo',
  LIMIT_REACHED: 'Limite Atingido',
  DISABLED: 'Desativado',
};

const actionLabels: Record<string, string> = {
  USER_SIGNIN: 'Login',
  MANUAL_CHECKIN: 'Check-in Manual',
  EVENT_DELETED: 'Evento Excluído',
  STUDENT_CREATED: 'Aluno Criado',
  STUDENT_UPDATED: 'Aluno Atualizado',
  SCHOOL_CREATED: 'Escola Criada',
};

export function SuperAdminDashboardClient({ data }: { data: DashboardData }) {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma Safe Door</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KPICard
          label="MRR"
          value={formatCurrency(data.mrr)}
          icon={DollarSign}
          color="emerald"
          sub={`ARR: ${formatCurrency(data.arr)}`}
        />
        <KPICard
          label="Escolas Ativas"
          value={data.activeSchools.toString()}
          icon={School}
          color="blue"
          sub={`${data.totalSchools} total`}
        />
        <KPICard
          label="Alunos"
          value={data.totalStudents.toLocaleString('pt-BR')}
          icon={GraduationCap}
          color="violet"
          sub={`${data.totalParents} responsáveis`}
        />
        <KPICard
          label="Eventos/Mês"
          value={data.eventsThisMonth.toLocaleString('pt-BR')}
          icon={Activity}
          color="amber"
          trend={data.eventsGrowth}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <CreditCard className="h-4 w-4" />
            Assinaturas Ativas
          </div>
          <p className="text-2xl font-bold">{data.activeSubscriptions}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <AlertTriangle className="h-4 w-4" />
            Escolas Suspensas
          </div>
          <p className="text-2xl font-bold text-red-400">{data.suspendedSchools}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Activity className="h-4 w-4" />
            Total de Registros
          </div>
          <p className="text-2xl font-bold">{data.totalEvents.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent Schools */}
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <School className="h-4 w-4 text-muted-foreground" />
              Escolas Recentes
            </h2>
          </div>
          <div className="divide-y divide-border">
            {data.recentSchools.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma escola cadastrada.</p>
            )}
            {data.recentSchools.map((school) => (
              <div key={school.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{school.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {school.students} alunos · {school.admins} admin(s)
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {school.plan && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {school.plan}
                    </span>
                  )}
                  <StatusBadge status={school.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AWS Accounts */}
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Cloud className="h-4 w-4 text-muted-foreground" />
              Contas AWS
            </h2>
          </div>
          <div className="divide-y divide-border">
            {data.awsAccounts.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma conta AWS configurada.</p>
            )}
            {data.awsAccounts.map((acc) => {
              const pct = acc.maxCollections > 0
                ? Math.round((acc.usedCollections / acc.maxCollections) * 100)
                : 0;
              return (
                <div key={acc.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{acc.label}</p>
                    <StatusBadge status={acc.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{acc.usedCollections}/{acc.maxCollections} collections ({pct}%)</span>
                    {acc.monthlyBudget && (
                      <span>
                        ${acc.currentSpend.toFixed(2)} / ${acc.monthlyBudget.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Atividade Recente
          </h2>
        </div>
        <div className="divide-y divide-border">
          {data.recentLogs.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
          )}
          {data.recentLogs.map((log) => {
            let meta: Record<string, any> = {};
            try { meta = log.metadata ? JSON.parse(log.metadata) : {}; } catch {}
            return (
              <div key={log.id} className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {actionLabels[log.action] || log.action}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {log.entityType && `${log.entityType} · `}
                    {meta.studentName || meta.email || ''}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">
                  {formatDate(log.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  icon: Icon,
  color,
  sub,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
  trend?: number;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    violet: 'text-violet-400 bg-violet-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xl lg:text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
          trend >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {trend >= 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(trend)}% vs mês anterior
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
      statusColors[status] || 'text-zinc-400 bg-zinc-400/10'
    }`}>
      {statusLabels[status] || status}
    </span>
  );
}
