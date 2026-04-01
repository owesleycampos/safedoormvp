'use client';

import { useState, useMemo } from 'react';
import {
  FileText, FileSpreadsheet, Search,
  Users, TrendingUp, XCircle, CalendarDays, ChevronLeft, ChevronRight,
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

function dateRange(from: Date, to: Date, max = 31): Date[] {
  const dates: Date[] = [];
  const d = new Date(from);
  while (d <= to && dates.length < max) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Mock data (replace with real API) ───────────────────────────────────────
function generateMockData(dates: Date[]): StudentRow[] {
  const CLASSES = ['1º Ano A', '2º Ano B', '3º Ano A'];
  const NAMES = [
    ['Ana Silva', 'Bruno Costa', 'Carla Oliveira', 'Diego Pereira', 'Eduarda Souza'],
    ['Felipe Lima', 'Gabriela Santos', 'Henrique Rocha', 'Isabela Ferreira', 'João Alves'],
    ['Karen Nunes', 'Lucas Barbosa', 'Mariana Castro', 'Nicolas Dias', 'Olivia Martins'],
  ];
  return CLASSES.flatMap((cls, ci) =>
    NAMES[ci].map((name, ni) => ({
      id: `${ci}-${ni}`,
      name,
      className: cls,
      attendance: Object.fromEntries(
        dates.map((d) => {
          const isWknd = d.getDay() === 0 || d.getDay() === 6;
          return [toDateStr(d), isWknd ? 'weekend' : Math.random() > 0.15 ? 'present' : 'absent'];
        })
      ),
    }))
  );
}

// ─── Mini Calendar for custom range ──────────────────────────────────────────
function MiniCalendar({
  from, to, onFromChange, onToChange,
}: {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap">De</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap">Até</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          min={from}
          className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
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

  // Compute display dates from preset
  const displayDates = useMemo(() => {
    if (preset === '7d')  return dateRange(addDays(today, -6), today);
    if (preset === '30d') return dateRange(addDays(today, -29), today);
    // custom
    const from = new Date(customFrom + 'T00:00:00');
    const to   = new Date(customTo   + 'T00:00:00');
    return from <= to ? dateRange(from, to) : dateRange(from, from);
  }, [preset, customFrom, customTo]);

  const allRows     = useMemo(() => generateMockData(displayDates), [displayDates]);
  const classNames  = useMemo(() => Array.from(new Set(allRows.map((r) => r.className))), [allRows]);

  const filteredRows = allRows.filter((r) => {
    const matchClass  = classFilter === 'all' || r.className === classFilter;
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  // Stats
  const totalCells   = filteredRows.reduce((s, r) => s + displayDates.filter((d) => r.attendance[toDateStr(d)] !== 'weekend').length, 0);
  const presentCells = filteredRows.reduce((s, r) => s + displayDates.filter((d) => r.attendance[toDateStr(d)] === 'present').length, 0);
  const rate         = totalCells > 0 ? Math.round((presentCells / totalCells) * 100) : 0;

  const periodLabel = preset === '7d' ? 'Últimos 7 dias'
    : preset === '30d' ? 'Últimos 30 dias'
    : `${customFrom} → ${customTo}`;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Relatórios"
        subtitle={periodLabel}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-4 md:p-6 space-y-4 overflow-x-hidden">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users,      value: filteredRows.length,    label: 'Alunos'    },
            { icon: TrendingUp, value: `${rate}%`,             label: 'Frequência' },
            { icon: XCircle,    value: totalCells - presentCells, label: 'Ausências' },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <s.icon className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
              </div>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Filter Bar */}
        <Card className="p-4">
          <div className="space-y-3">
            {/* Preset selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                <TabsList>
                  <TabsTrigger value="7d">
                    <CalendarDays className="h-3 w-3 mr-1.5" />
                    7 dias
                  </TabsTrigger>
                  <TabsTrigger value="30d">
                    <CalendarDays className="h-3 w-3 mr-1.5" />
                    30 dias
                  </TabsTrigger>
                  <TabsTrigger value="custom">Personalizado</TabsTrigger>
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
                  className="pl-7 h-8 text-xs w-[140px]"
                />
              </div>
            </div>

            {/* Custom date range */}
            {preset === 'custom' && (
              <div className="pt-1 border-t border-border">
                <MiniCalendar
                  from={customFrom}
                  to={customTo}
                  onFromChange={setCustomFrom}
                  onToChange={setCustomTo}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap sticky left-0 bg-secondary/20 backdrop-blur-sm z-10 min-w-[140px]">
                    Aluno
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    Turma
                  </th>
                  {displayDates.map((d) => {
                    const isWknd  = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = toDateStr(d) === toDateStr(today);
                    return (
                      <th
                        key={toDateStr(d)}
                        className={cn(
                          'text-center px-1.5 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[40px]',
                          isWknd && 'opacity-30',
                          isToday && 'text-foreground'
                        )}
                      >
                        <div className="text-[10px]">{DAY_SHORT[d.getDay()]}</div>
                        <div className="text-[10px] font-normal">{d.getDate()}/{d.getMonth() + 1}</div>
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
                    <td colSpan={displayDates.length + 3} className="text-center py-10 text-sm text-muted-foreground">
                      Nenhum aluno encontrado
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const weekdays  = displayDates.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
                    const presences = weekdays.filter((d) => row.attendance[toDateStr(d)] === 'present').length;
                    const freq      = weekdays.length > 0 ? Math.round((presences / weekdays.length) * 100) : 0;
                    return (
                      <tr key={row.id} className="hover:bg-secondary/20 transition-colors group">
                        <td className="px-4 py-2.5 font-medium text-xs whitespace-nowrap sticky left-0 bg-card group-hover:bg-secondary/20 z-10">
                          {row.name}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap hidden sm:table-cell">
                          <Badge variant="outline" className="text-[10px]">{row.className}</Badge>
                        </td>
                        {displayDates.map((d) => {
                          const ds     = toDateStr(d);
                          const status = row.attendance[ds];
                          return (
                            <td key={ds} className={cn('text-center px-1.5 py-2.5', status === 'weekend' && 'opacity-25')}>
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
                              : freq >= 50 ? 'bg-warn/10 text-warn'
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
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {filteredRows.length} aluno{filteredRows.length !== 1 ? 's' : ''} · {displayDates.length} dia{displayDates.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2 ml-auto sm:hidden">
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
