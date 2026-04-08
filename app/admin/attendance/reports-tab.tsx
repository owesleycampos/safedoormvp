'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet, Search,
  Users, TrendingUp, XCircle, Loader2,
  Clock, AlertTriangle, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentRow {
  id: string;
  name: string;
  className: string;
  attendance: Record<string, 'present' | 'absent' | 'weekend' | 'late'>;
}

interface AlertStudent {
  id: string;
  name: string;
  className: string;
  photoUrl: string | null;
  totalDays: number;
  absentDays: number;
  absenceRate: number;
  status: 'warning' | 'critical';
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

// ─── PDF export (print) ──────────────────────────────────────────────────────
function exportPdf(rows: StudentRow[], dates: string[], classFilter: string) {
  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Compute summary stats
  const totalStudents = rows.length;
  let totalWeekdays = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  const freqs: number[] = [];

  rows.forEach(r => {
    const wd = dates.filter(d => r.attendance[d] !== 'weekend');
    const pr = wd.filter(d => r.attendance[d] === 'present' || r.attendance[d] === 'late').length;
    const late = wd.filter(d => r.attendance[d] === 'late').length;
    const absent = wd.length - pr;
    const freq = wd.length > 0 ? Math.round((pr / wd.length) * 100) : 0;
    totalWeekdays += wd.length;
    totalPresent += pr;
    totalAbsent += absent;
    totalLate += late;
    freqs.push(freq);
  });

  const avgFreq = freqs.length > 0 ? Math.round(freqs.reduce((a, b) => a + b, 0) / freqs.length) : 0;

  const html = `<!DOCTYPE html>
<html><head><title>Relatório de Frequência</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10px; color: #111; margin: 0; padding: 24px; }

  /* Header */
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #111; }
  .logo-placeholder { width: 48px; height: 48px; border: 1.5px solid #999; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-text h1 { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
  .header-text p { font-size: 10px; color: #666; margin-top: 2px; }

  /* Meta info */
  .meta-row { display: flex; gap: 24px; margin-bottom: 16px; font-size: 10px; color: #444; }
  .meta-row strong { color: #111; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f5f5f5; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; padding: 5px 4px; border: 1px solid #ddd; text-align: center; color: #333; }
  td { border: 1px solid #e5e5e5; padding: 4px 5px; text-align: center; font-size: 10px; }
  td.name { text-align: left; font-weight: 500; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody tr:hover { background: #f0f0f0; }
  .freq-bold { font-weight: 700; }
  .freq-normal { font-weight: 400; color: #666; }

  /* Summary */
  .summary { margin-top: 8px; padding: 12px 16px; border: 1.5px solid #ddd; border-radius: 6px; background: #fafafa; }
  .summary h3 { font-size: 11px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-grid { display: flex; gap: 32px; }
  .summary-item { text-align: center; }
  .summary-item .value { font-size: 18px; font-weight: 700; }
  .summary-item .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }

  /* Footer */
  .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 9px; color: #999; }

  @media print {
    body { margin: 10px; padding: 10px; }
    .summary { break-inside: avoid; }
  }
</style></head><body>

<!-- Header -->
<div class="header">
  <div class="logo-placeholder">Logo</div>
  <div class="header-text">
    <h1>Relatório de Frequência</h1>
    <p>${classFilter !== 'all' ? `Turma: ${rows[0]?.className || classFilter}` : 'Todas as turmas'} · ${dates[0]} a ${dates[dates.length - 1]}</p>
  </div>
</div>

<!-- Meta -->
<div class="meta-row">
  <span><strong>${totalStudents}</strong> alunos</span>
  <span><strong>${dates.length}</strong> dias no período</span>
  <span>Frequência média: <strong>${avgFreq}%</strong></span>
</div>

<!-- Table -->
<table>
<thead><tr><th style="text-align:left; min-width: 100px;">Aluno</th><th>Turma</th>
${dates.map(d => {
    const dt = new Date(d + 'T12:00:00');
    return `<th>${weekdayNames[dt.getDay()]}<br>${dt.getDate()}/${dt.getMonth() + 1}</th>`;
  }).join('')}
<th>Freq.</th><th>Atrasos</th></tr></thead>
<tbody>
${rows.map(r => {
    const wd = dates.filter(d => r.attendance[d] !== 'weekend');
    const pr = wd.filter(d => r.attendance[d] === 'present' || r.attendance[d] === 'late').length;
    const late = wd.filter(d => r.attendance[d] === 'late').length;
    const freq = wd.length > 0 ? Math.round((pr / wd.length) * 100) : 0;
    return `<tr><td class="name">${r.name}</td><td>${r.className}</td>
${dates.map(d => {
      const s = r.attendance[d];
      return `<td>${s === 'present' ? 'P' : s === 'late' ? 'A' : s === 'absent' ? 'F' : '—'}</td>`;
    }).join('')}
<td class="${freq >= 75 ? 'freq-bold' : 'freq-normal'}">${freq}%</td><td>${late || ''}</td></tr>`;
  }).join('')}
</tbody></table>

<!-- Summary -->
<div class="summary">
  <h3>Resumo do Período</h3>
  <div class="summary-grid">
    <div class="summary-item">
      <div class="value">${totalStudents}</div>
      <div class="label">Total de Alunos</div>
    </div>
    <div class="summary-item">
      <div class="value">${avgFreq}%</div>
      <div class="label">Frequência Média</div>
    </div>
    <div class="summary-item">
      <div class="value">${totalAbsent}</div>
      <div class="label">Total de Ausências</div>
    </div>
    <div class="summary-item">
      <div class="value">${totalLate}</div>
      <div class="label">Total de Atrasos</div>
    </div>
  </div>
</div>

<!-- Footer -->
<div class="footer">
  <span>P = Presente · A = Atraso · F = Falta</span>
  <span>Gerado em ${new Date().toLocaleString('pt-BR')} · Safe Door Brasil</span>
</div>

</body></html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCsv(rows: StudentRow[], dates: string[]) {
  const header = ['Aluno', 'Turma', ...dates, 'Frequência(%)', 'Atrasos'].join(',');
  const lines = rows.map((r) => {
    const weekdays = dates.filter((d) => r.attendance[d] !== 'weekend');
    const present = weekdays.filter((d) => r.attendance[d] === 'present' || r.attendance[d] === 'late').length;
    const lateCount = weekdays.filter((d) => r.attendance[d] === 'late').length;
    const freq = weekdays.length > 0 ? Math.round((present / weekdays.length) * 100) : 0;
    return [
      `"${r.name}"`,
      `"${r.className}"`,
      ...dates.map((d) => {
        const s = r.attendance[d];
        return s === 'present' ? 'P' : s === 'late' ? 'A' : s === 'absent' ? 'F' : '-';
      }),
      `${freq}%`,
      lateCount,
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
export default function ReportsTab() {
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

  const [alerts, setAlerts] = useState<AlertStudent[]>([]);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  const { from, to } = useMemo(() => {
    if (preset === '7d') return { from: toDateStr(addDays(today, -6)), to: toDateStr(today) };
    if (preset === '30d') return { from: toDateStr(addDays(today, -29)), to: toDateStr(today) };
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo]);

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

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ days: '30' });
      if (classFilter !== 'all') params.set('classId', classFilter);
      const res = await fetch(`/api/reports/alerts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.students ?? []);
      }
    } catch {
      setAlerts([]);
    }
  }, [classFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const classNames = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.className))).sort(),
    [allRows]
  );

  const filteredRows = allRows.filter((r) => {
    const matchClass = classFilter === 'all' || r.className === classFilter;
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  const totalCells = filteredRows.reduce((s, r) => s + dates.filter((d) => r.attendance[d] !== 'weekend').length, 0);
  const presentCells = filteredRows.reduce((s, r) => s + dates.filter((d) => r.attendance[d] === 'present' || r.attendance[d] === 'late').length, 0);
  const lateCells = filteredRows.reduce((s, r) => s + dates.filter((d) => r.attendance[d] === 'late').length, 0);
  const rate = totalCells > 0 ? Math.round((presentCells / totalCells) * 100) : 0;
  const absenceCells = totalCells - presentCells;

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4 overflow-x-hidden">

      {/* Alerts banner (inline, collapsible) */}
      {alerts.length > 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setAlertsExpanded(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-foreground flex-1">
              <span className="font-medium">{alerts.length} aluno{alerts.length !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground"> com frequência abaixo de 75%</span>
            </p>
            {alertsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {alertsExpanded && (
            <div className="border-t border-border divide-y divide-border">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-1.5 w-1.5 rounded-full flex-shrink-0 bg-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.className}</p>
                  </div>
                  <span className="text-xs font-medium tabular-nums">
                    {Math.round(100 - a.absenceRate)}%
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                    {a.status === 'critical' ? 'Crítico' : 'Alerta'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {[
          { icon: Users, value: loading ? '…' : filteredRows.length, label: 'Alunos' },
          { icon: TrendingUp, value: loading ? '…' : `${rate}%`, label: 'Frequência' },
          { icon: XCircle, value: loading ? '…' : absenceCells, label: 'Ausências' },
          { icon: Clock, value: loading ? '…' : lateCells, label: 'Atrasos' },
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

      {/* Toolbar */}
      <Card className="p-3 md:p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period pills */}
          <div className="flex items-center gap-1">
            {(['7d', '30d', 'custom'] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={cn(
                  'h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors',
                  preset === p
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : 'Personalizado'}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportPdf(filteredRows, dates, classFilter)}
            disabled={loading || filteredRows.length === 0}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
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

        {preset === 'custom' && (
          <div className="pt-3 mt-3 border-t border-border flex items-center gap-3 flex-wrap">
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
      </Card>

      {/* ── Frequency Table ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Mobile: card list */}
      {!loading && filteredRows.length > 0 && (
        <div className="md:hidden space-y-3">
          {filteredRows.map((row) => {
            const weekdays = dates.filter((d) => row.attendance[d] !== 'weekend');
            const presences = weekdays.filter((d) => row.attendance[d] === 'present' || row.attendance[d] === 'late').length;
            const lateCount = weekdays.filter((d) => row.attendance[d] === 'late').length;
            const freq = weekdays.length > 0 ? Math.round((presences / weekdays.length) * 100) : 0;
            const absences = weekdays.length - presences;

            return (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold">{row.name}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{row.className}</Badge>
                  </div>
                  <span className={cn(
                    'inline-flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-bold',
                    freq >= 75 ? 'bg-foreground/[0.06] text-foreground'
                      : freq >= 50 ? 'bg-muted text-muted-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {freq}%
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-md bg-secondary/50 p-2">
                    <p className="text-muted-foreground text-[10px]">Dias</p>
                    <p className="font-semibold mt-0.5">{weekdays.length}</p>
                  </div>
                  <div className="rounded-md bg-foreground/10 p-2">
                    <p className="text-muted-foreground text-[10px]">Presente</p>
                    <p className="font-semibold mt-0.5">{presences}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-muted-foreground text-[10px]">Ausente</p>
                    <p className="font-semibold mt-0.5">{absences}</p>
                  </div>
                  <div className="rounded-md bg-muted-foreground/10 p-2">
                    <p className="text-muted-foreground text-[10px]">Atraso</p>
                    <p className="font-semibold text-muted-foreground mt-0.5">{lateCount}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 overflow-hidden">
                  {dates.slice(-7).map((d) => {
                    const status = row.attendance[d];
                    return (
                      <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                        <span className={cn(
                          'inline-block h-2.5 w-full max-w-[2.5rem] rounded-sm',
                          status === 'weekend' ? 'bg-border/40'
                            : status === 'present' ? 'bg-foreground'
                            : status === 'late' ? 'bg-muted-foreground'
                            : 'bg-muted-foreground/30'
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

      {/* Desktop: table */}
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
                    const dt = new Date(d + 'T12:00:00');
                    const isWknd = dt.getDay() === 0 || dt.getDay() === 6;
                    const isTdy = d === toDateStr(today);
                    return (
                      <th
                        key={d}
                        className={cn(
                          'text-center px-1.5 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[40px]',
                          isWknd && 'opacity-30',
                          isTdy && 'text-foreground'
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
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    Atrasos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={dates.length + 4} className="text-center py-10 text-sm text-muted-foreground">
                      Nenhum aluno encontrado
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const weekdays = dates.filter((d) => row.attendance[d] !== 'weekend');
                    const presences = weekdays.filter((d) => row.attendance[d] === 'present' || row.attendance[d] === 'late').length;
                    const lateCount = weekdays.filter((d) => row.attendance[d] === 'late').length;
                    const freq = weekdays.length > 0 ? Math.round((presences / weekdays.length) * 100) : 0;
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
                                <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
                              ) : status === 'late' ? (
                                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
                              ) : (
                                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2.5">
                          <span className={cn(
                            'inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-medium',
                            freq >= 75 ? 'bg-foreground/[0.06] text-foreground'
                              : freq >= 50 ? 'bg-muted-foreground/10 text-muted-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {freq}%
                          </span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          {lateCount > 0 && (
                            <span className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-muted-foreground/10 text-muted-foreground">
                              {lateCount}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-secondary/10 flex-wrap">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-foreground" />Presente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />Atraso
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />Ausente
              </span>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredRows.length} aluno{filteredRows.length !== 1 ? 's' : ''} · {dates.length} dia{dates.length !== 1 ? 's' : ''}
            </span>
          </div>
        </Card>
      )}

      {!loading && filteredRows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum aluno encontrado</p>
        </div>
      )}
    </div>
  );
}
