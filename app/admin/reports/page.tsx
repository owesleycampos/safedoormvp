'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FileText, FileSpreadsheet, Search,
  Users, TrendingUp, XCircle, CalendarDays, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminHeader } from '@/components/admin/header';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentRow {
  id: string;
  name: string;
  className: string;
  attendance: Record<string, 'present' | 'absent' | 'weekend'>;
}

type Preset = '7d' | '30d' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCsv(rows: StudentRow[], dates: string[]) {
  const header = ['Aluno', 'Turma', ...dates, 'Frequência(%)'].join(',');
  const lines = rows.map((r) => {
    const weekdays = dates.filter((d) => r.attendance[d] !== 'weekend');
    const present  = weekdays.filter((d) => r.attendance[d] === 'present').length;
    const freq = weekdays.length > 0 ? Math.round((present / weekdays.length) * 100) : 0;
    return [
      `"${r.name}"`,
      `"${r.className}"`,
      ...dates.map((d) => r.attendance[d] === 'present' ? 'P' : r.attendance[d] === 'absent' ? 'F' : '-'),
      `${freq}%`,
    ].join(',');
  });
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frequencia_${dates[0]}_${dates[dates.length - 1]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [preset, setPreset] = useState<Preset>('7d');
  const [customFrom, setCustomFrom] = useState(toDateStr(addDays(today, -29)));
  const [customTo, setCustomTo] = useState(toDateStr(today));
  const [classFilter, setClassFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [allRows, setAllRows] = useState<StudentRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Compute date range from preset
  const { from, to } = useMemo(() => {
    if (preset === '7d')  return { from: toDateStr(addDays(today, -6)), to: toDateStr(today) };
    if (preset === '30d') return { from: toDateStr(addDays(today, -29)), to: toDateStr(today) };
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo]);

  // Fetch real data from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/attendance?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Erro ao buscar dados');
      const data = await res.json();
      setAllRows(data.rows ?? []);
      setDates(data.dates ?? []);
    } catch {
      setAllRows([]);
      setDates([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const classNames = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.className))).sort(),
    [allRows]
  );

  const filteredRows = allRows.filter((r) => {
    const matchClass  = classFilter === 'all' || r.className === classFilter;
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  // Stats
  const totalCells   = filteredRows.reduce((s, r) => s + dates.filter((d) => r.attendance[d] !== 'weekend').length, 0);
  const presentCells = filteredRows.reduce((s, r) => s + dates.filter((d) => r.attendance[d] === 'present').length, 0);
  const rate         = totalCells > 0 ? Math.round((presentCells / totalCells) * 100) : 0;
  const absenceCells = totalCells - presentCells;

  const periodLabel = preset === '7d' ? 'Últimos 7 dias'
    : preset === '30d' ? 'Últimos 30 dias'
    : `${from} → ${to}`;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Relatórios"
        subtitle={periodLabel}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportCsv(filteredRows, dates)}
              disabled={loading || filteredRows.length === 0}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-3 md:p-6 space-y-4 overflow-x-hidden">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {[
            { icon: Users,      value: loading ? '…' : filteredRows.length, label: 'Alunos'    },
            { icon: TrendingUp, value: loading ? '…' : `${rate}%`,          label: 'Frequência' },
            { icon: XCircle,    value: loading ? '…' : absenceCells,        label: 'Ausências'  },
          ].map((s) => (
            <Card key={s.label} className="p-3 md:p-4">
              <div className="flex items-start justify-between mb-1 md:mb-2">
                <p className="text-[11px] md:text-xs text-muted-foreground">{s.label}</p>
                <s.icon className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
              </div>
              <p className="text-xl md:text-2xl font-semibold tabular-nums">{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Filter Bar */}
        <Card className="p-3 md:p-4">
          <div className="space-y-3">
            {/* Preset selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                <TabsList>
                  <TabsTrigger value="7d" className="text-xs">
                    <CalendarDays className="h-3 w-3 mr-1" />
                    7 dias
                  </TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs">
                    <CalendarDays className="h-3 w-3 mr-1" />
                    30 dias
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs">Personalizado</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex-1" />

              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">Todas as turmas</option>
                {classNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar aluno..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-8 text-xs w-[130px] md:w-[160px]"
                />
              </div>
            </div>

            {/* Custom date range */}
            {preset === 'custom' && (
              <div className="pt-1 border-t border-border flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">De</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Até</label>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Mobile: card list (visible on mobile, hidden on md+) */}
        {!loading && filteredRows.length > 0 && (
          <div className="md:hidden space-y-3">
            {filteredRows.map((row) => {
              const weekdays  = dates.filter((d) => row.attendance[d] !== 'weekend');
              const presences = weekdays.filter((d) => row.attendance[d] === 'present').length;
              const freq      = weekdays.length > 0 ? Math.round((presences / weekdays.length) * 100) : 0;
              const absences  = weekdays.length - presences;

              return (
                <Card key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold">{row.name}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{row.className}</Badge>
                    </div>
                    <span className={cn(
                      'inline-flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-bold',
                      freq >= 75 ? 'bg-success/10 text-success'
                        : freq >= 50 ? 'bg-yellow-500/10 text-yellow-600'
                        : 'bg-destructive/10 text-destructive'
                    )}>
                      {freq}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-secondary/50 p-2">
                      <p className="text-muted-foreground text-[10px]">Dias úteis</p>
                      <p className="font-semibold mt-0.5">{weekdays.length}</p>
                    </div>
                    <div className="rounded-md bg-success/10 p-2">
                      <p className="text-muted-foreground text-[10px]">Presentes</p>
                      <p className="font-semibold text-success mt-0.5">{presences}</p>
                    </div>
                    <div className="rounded-md bg-destructive/10 p-2">
                      <p className="text-muted-foreground text-[10px]">Ausências</p>
                      <p className="font-semibold text-destructive mt-0.5">{absences}</p>
                    </div>
                  </div>

                  {/* Mini dot timeline — last 7 days */}
                  <div className="flex items-center gap-1 mt-3 overflow-hidden">
                    {dates.slice(-7).map((d) => {
                      const status = row.attendance[d];
                      return (
                        <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className={cn(
                            'inline-block h-2.5 w-full max-w-[2.5rem] rounded-sm',
                            status === 'weekend' ? 'bg-border/40'
                            : status === 'present' ? 'bg-success'
                            : 'bg-destructive/40'
                          )} />
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(d + 'T12:00:00').getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Desktop: table (hidden on mobile) */}
        {!loading && (
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap sticky left-0 bg-secondary/20 backdrop-blur-sm z-10 min-w-[140px]">
                      Aluno
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Turma
                    </th>
                    {dates.map((d) => {
                      const dt      = new Date(d + 'T12:00:00');
                      const isWknd  = dt.getDay() === 0 || dt.getDay() === 6;
                      const isToday = d === toDateStr(today);
                      return (
                        <th
                          key={d}
                          className={cn(
                            'text-center px-1.5 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[40px]',
                            isWknd && 'opacity-30',
                            isToday && 'text-foreground'
                          )}
                        >
                          <div className="text-[10px]">{DAY_SHORT[dt.getDay()]}</div>
                          <div className="text-[10px] font-normal">{dt.getDate()}/{dt.getMonth() + 1}</div>
                        </th>
                      );
                    })}
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Freq.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={dates.length + 3} className="text-center py-10 text-sm text-muted-foreground">
                        Nenhum aluno encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const weekdays  = dates.filter((d) => row.attendance[d] !== 'weekend');
                      const presences = weekdays.filter((d) => row.attendance[d] === 'present').length;
                      const freq      = weekdays.length > 0 ? Math.round((presences / weekdays.length) * 100) : 0;
                      return (
                        <tr key={row.id} className="hover:bg-secondary/20 transition-colors group">
                          <td className="px-4 py-2.5 font-medium text-xs whitespace-nowrap sticky left-0 bg-card group-hover:bg-secondary/20 z-10">
                            {row.name}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px]">{row.className}</Badge>
                          </td>
                          {dates.map((d) => {
                            const status = row.attendance[d];
                            return (
                              <td key={d} className={cn('text-center px-1.5 py-2.5', status === 'weekend' && 'opacity-25')}>
                                {status === 'weekend' ? (
                                  <span className="text-muted-foreground text-[10px]">—</span>
                                ) : status === 'present' ? (
                                  <span className="inline-block h-2 w-2 rounded-full bg-success" />
                                ) : (
                                  <span className="inline-block h-2 w-2 rounded-full bg-destructive/40" />
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center px-3 py-2.5">
                            <span className={cn(
                              'inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-medium',
                              freq >= 75 ? 'bg-success/10 text-success'
                                : freq >= 50 ? 'bg-yellow-500/10 text-yellow-600'
                                : 'bg-destructive/10 text-destructive'
                            )}>
                              {freq}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-secondary/10 flex-wrap">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" />Presente
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-destructive/40" />Ausente
                </span>
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredRows.length} aluno{filteredRows.length !== 1 ? 's' : ''} · {dates.length} dia{dates.length !== 1 ? 's' : ''}
              </span>
            </div>
          </Card>
        )}

        {!loading && filteredRows.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum aluno encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
