'use client';

import { useState } from 'react';
import {
  ScrollText, Search, Filter, User, Clock, School,
  Shield, Activity,
} from 'lucide-react';

interface LogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
  userName: string | null;
  userRole: string | null;
  schoolName: string | null;
}

const actionColors: Record<string, string> = {
  USER_SIGNIN: 'text-blue-400 bg-blue-400/10',
  MANUAL_CHECKIN: 'text-emerald-400 bg-emerald-400/10',
  EVENT_DELETED: 'text-red-400 bg-red-400/10',
  STUDENT_CREATED: 'text-violet-400 bg-violet-400/10',
  STUDENT_UPDATED: 'text-amber-400 bg-amber-400/10',
  SCHOOL_CREATED: 'text-emerald-400 bg-emerald-400/10',
  SCHOOL_SUSPENDED: 'text-red-400 bg-red-400/10',
  SCHOOL_REACTIVATED: 'text-emerald-400 bg-emerald-400/10',
};

const actionLabels: Record<string, string> = {
  USER_SIGNIN: 'Login',
  MANUAL_CHECKIN: 'Check-in Manual',
  EVENT_DELETED: 'Evento Excluído',
  STUDENT_CREATED: 'Aluno Criado',
  STUDENT_UPDATED: 'Aluno Atualizado',
  SCHOOL_CREATED: 'Escola Criada',
  SCHOOL_SUSPENDED: 'Escola Suspensa',
  SCHOOL_REACTIVATED: 'Escola Reativada',
  INVOICE_CREATED: 'Fatura Criada',
  INVOICE_PAID: 'Fatura Paga',
  AWS_ACCOUNT_CREATED: 'Conta AWS Criada',
};

const roleColors: Record<string, string> = {
  SUPERADMIN: 'text-emerald-400',
  ADMIN: 'text-blue-400',
  PARENT: 'text-zinc-400',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function LogsClient({ logs }: { logs: LogEntry[] }) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const actions = Array.from(new Set(logs.map((l) => l.action)));

  const filtered = logs.filter((l) => {
    const matchSearch = search === '' ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.userName?.toLowerCase().includes(search.toLowerCase()) ||
      l.schoolName?.toLowerCase().includes(search.toLowerCase()) ||
      l.metadata?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold">Logs de Auditoria</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {logs.length} registros (últimos 200)
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por ação, usuário, escola..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-border bg-background"
        >
          <option value="ALL">Todas as ações</option>
          {actions.map((a) => (
            <option key={a} value={a}>{actionLabels[a] || a}</option>
          ))}
        </select>
      </div>

      {/* Logs List */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <ScrollText className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Nenhum log encontrado.</p>
          </div>
        )}
        {filtered.map((log) => {
          let meta: Record<string, any> = {};
          try { meta = log.metadata ? JSON.parse(log.metadata) : {}; } catch {}

          return (
            <div key={log.id} className="p-3 lg:p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
              {/* Icon */}
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                actionColors[log.action] || 'text-zinc-400 bg-zinc-400/10'
              }`}>
                <Activity className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {actionLabels[log.action] || log.action}
                  </span>
                  {log.entityType && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {log.entityType}
                    </span>
                  )}
                </div>

                {/* User info */}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {log.userName && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className={roleColors[log.userRole || ''] || ''}>
                        {log.userName}
                      </span>
                    </span>
                  )}
                  {log.schoolName && (
                    <span className="flex items-center gap-1">
                      <School className="h-3 w-3" />
                      {log.schoolName}
                    </span>
                  )}
                  {log.ipAddress && (
                    <span className="hidden lg:inline">{log.ipAddress}</span>
                  )}
                </div>

                {/* Metadata */}
                {Object.keys(meta).length > 0 && (
                  <div className="mt-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 font-mono max-w-full overflow-x-auto">
                    {Object.entries(meta).map(([k, v]) => (
                      <span key={k} className="mr-3">
                        <span className="text-muted-foreground/70">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground flex-shrink-0">
                <Clock className="h-3 w-3" />
                {formatDateTime(log.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
