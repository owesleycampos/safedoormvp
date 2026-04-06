'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserCheck, UserX, Clock, LogIn, LogOut,
  ClipboardEdit, Loader2, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AdminHeader } from '@/components/admin/header';
import { toast } from '@/components/ui/toaster';
import { cn, getInitials } from '@/lib/utils';

interface StudentRow {
  id: string;
  name: string;
  photoUrl: string | null;
  className: string;
  classId: string;
  status: 'present' | 'absent' | 'left' | 'entry_only';
  entryTime: string | null;
  entryManual: boolean;
  exitTime: string | null;
  exitManual: boolean;
  confidence: number | null;
}

interface DailyData {
  date: string;
  summary: { total: number; present: number; absent: number; left: number; entryOnly: number };
  students: StudentRow[];
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default function DailyPage() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [classFilter, setClassFilter] = useState('all');
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);

  const dateStr = date.toISOString().slice(0, 10);
  const isToday = dateStr === new Date().toISOString().slice(0, 10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: dateStr });
      if (classFilter !== 'all') params.set('classId', classFilter);
      const res = await fetch(`/api/reports/daily?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateStr, classFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Get unique classes from data
  const classes = data
    ? Array.from(new Map(data.students.map((s) => [s.classId, s.className])).entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
    : [];

  const filtered = data?.students ?? [];

  // Manual registration
  async function registerManual(studentId: string, eventType: 'ENTRY' | 'EXIT') {
    setRegistering(`${studentId}:${eventType}`);
    try {
      const res = await fetch('/api/events/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, eventType }),
      });
      if (res.ok) {
        toast({ variant: 'success', title: eventType === 'ENTRY' ? 'Entrada registrada' : 'Saída registrada' });
        fetchData();
      } else {
        const d = await res.json();
        toast({ variant: 'destructive', title: 'Erro', description: d.error });
      }
    } finally {
      setRegistering(null);
    }
  }

  const dayLabel = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Chamada Diária"
        subtitle={dayLabel}
        actions={
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        }
      />

      <div className="flex-1 p-3 md:p-6 space-y-4 overflow-y-auto">

        {/* Date nav + class filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setDate((d) => addDays(d, -1))}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDate(new Date(e.target.value + 'T00:00:00'))}
              className="h-8 bg-transparent px-2 text-xs text-foreground focus:outline-none"
            />
            <button
              onClick={() => setDate((d) => addDays(d, 1))}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent"
              disabled={isToday}
            >
              <ChevronRight className={cn('h-4 w-4', isToday && 'opacity-30')} />
            </button>
          </div>

          {!isToday && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDate(new Date())}>
              Hoje
            </Button>
          )}

          <div className="flex-1" />

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todas as turmas</option>
            {classes.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Total', value: data.summary.total, icon: Users, color: '' },
              { label: 'Presentes', value: data.summary.present, icon: UserCheck, color: 'text-success' },
              { label: 'Ausentes', value: data.summary.absent, icon: UserX, color: 'text-destructive' },
              { label: 'Na escola', value: data.summary.entryOnly, icon: Clock, color: 'text-blue-500' },
            ].map((s) => (
              <Card key={s.label} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <s.icon className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
                <p className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Student list */}
        {!loading && filtered.length > 0 && (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {filtered.map((s) => {
                const statusConfig = {
                  present: { label: 'Na escola', badge: 'entry' as const, color: 'border-l-success' },
                  entry_only: { label: 'Na escola', badge: 'entry' as const, color: 'border-l-success' },
                  left: { label: 'Saiu', badge: 'exit' as const, color: 'border-l-blue-400' },
                  absent: { label: 'Ausente', badge: 'destructive' as const, color: 'border-l-destructive' },
                };
                const cfg = statusConfig[s.status];

                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 border-l-4',
                      cfg.color
                    )}
                  >
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src={s.photoUrl || ''} alt={s.name} />
                      <AvatarFallback className="text-[11px] bg-secondary">
                        {getInitials(s.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{s.className}</Badge>
                        {s.entryTime && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <LogIn className="h-2.5 w-2.5" />
                            {formatTime(s.entryTime)}
                            {s.entryManual && <span className="text-[9px]">(M)</span>}
                          </span>
                        )}
                        {s.exitTime && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <LogOut className="h-2.5 w-2.5" />
                            {formatTime(s.exitTime)}
                            {s.exitManual && <span className="text-[9px]">(M)</span>}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant={cfg.badge} className="text-[10px]">{cfg.label}</Badge>

                      {/* Manual actions — only for today */}
                      {isToday && s.status === 'absent' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Registrar entrada manual"
                          onClick={() => registerManual(s.id, 'ENTRY')}
                          disabled={registering === `${s.id}:ENTRY`}
                        >
                          {registering === `${s.id}:ENTRY`
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <LogIn className="h-3.5 w-3.5 text-success" />}
                        </Button>
                      )}
                      {isToday && (s.status === 'entry_only' || s.status === 'present') && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Registrar saída manual"
                          onClick={() => registerManual(s.id, 'EXIT')}
                          disabled={registering === `${s.id}:EXIT`}
                        >
                          {registering === `${s.id}:EXIT`
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <LogOut className="h-3.5 w-3.5 text-orange-500" />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum aluno encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
