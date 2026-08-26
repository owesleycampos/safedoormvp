'use client';

import { useEffect, useState } from 'react';
import { FileSearch } from 'lucide-react';
import { Card } from '@/components/ui/card';

const LABELS: Record<string, string> = {
  HQ_IMPERSONATE_START: 'Abriu tela como usuário',
  HQ_IMPERSONATE_END: 'Encerrou impersonação',
  HQ_RECOGNITION_PAUSED: 'Pausou reconhecimento',
  HQ_RECOGNITION_RESUMED: 'Retomou reconhecimento',
  PARENT_PASSWORD_RESET: 'Resetou senha de responsável',
  STUDENTS_BULK_MOVED: 'Moveu alunos de turma',
  EVENT_DELETED: 'Apagou evento de presença',
  PARENT_INVITE_LINKED: 'Responsável vinculado por convite',
  INVOICE_PAID: 'Fatura marcada como paga',
  DIGEST_SENT: 'Resumo diário enviado',
};

function labelFor(a: string) { return LABELS[a] || a; }

export function AuditClient() {
  const [data, setData] = useState<any>(null);
  const [action, setAction] = useState('');

  async function load(a: string) {
    const res = await fetch(`/api/hq/audit${a ? `?action=${encodeURIComponent(a)}` : ''}`);
    if (res.ok) setData(await res.json());
  }
  useEffect(() => { load(action); }, [action]);

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 max-w-[1000px] mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <FileSearch className="h-5 w-5" /> Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Tudo que acontece na plataforma, com autor e horário.</p>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="input-base h-9 max-w-[240px] text-sm"
        >
          <option value="">Todas as ações</option>
          {data?.actions?.map((a: string) => (
            <option key={a} value={a}>{labelFor(a)}</option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {!data && <div className="p-8"><div className="h-4 w-1/2 bg-muted rounded animate-pulse" /></div>}
          {data?.logs?.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum registro.</p>
          )}
          {data?.logs?.map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{labelFor(log.action)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {log.actor ? (log.actor.name || log.actor.email) : 'sistema'}
                  {log.entityType ? ` · ${log.entityType}` : ''}
                  {log.ipAddress ? ` · ${log.ipAddress}` : ''}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
                {new Date(log.createdAt).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
