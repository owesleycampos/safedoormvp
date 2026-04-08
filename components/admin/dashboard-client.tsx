'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  LogIn, LogOut, Clock, ClipboardEdit, TrendingUp, TrendingDown,
  Video, AlertTriangle, WifiOff,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ManualCheckinWizard } from '@/components/admin/manual-checkin-wizard';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';
import Link from 'next/link';

interface TrendPoint { date: string; present: number; total: number }

interface StatsData {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount?: number;
  recentEvents: any[];
  unrecognizedCount: number;
  classes: { id: string; name: string }[];
  trend?: TrendPoint[];
}

const POLL_INTERVAL_MS = 15_000;

/* ── Animated Counter (spring) ────────────────────────────────── */
function AnimatedNumber({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      type: 'spring',
      stiffness: 80,
      damping: 20,
      mass: 0.8,
    });
    const unsubscribe = rounded.on('change', (v) => setDisplay(v));
    return () => { controls.stop(); unsubscribe(); };
  }, [value]);

  return <>{display}</>;
}

/* ── Line Chart ───────────────────────────────────────────────── */
function LineChart({ data }: { data: TrendPoint[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const workdays = data.filter(t => {
    const d = new Date(t.date + 'T12:00:00').getDay();
    return d !== 0 && d !== 6;
  });
  if (workdays.length < 2) return null;

  const rates = workdays.map(t => t.total > 0 ? (t.present / t.total) * 100 : 0);
  const w = 700, h = 220, px = 40, py = 20;
  const cW = w - px * 2, cH = h - py * 2;

  const pts = rates.map((r, i) => ({
    x: px + (i / (rates.length - 1)) * cW,
    y: py + cH - (r / 100) * cH,
  }));

  const line = pts.reduce((a, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${a} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const area = `${line} L ${pts[pts.length - 1].x} ${py + cH} L ${pts[0].x} ${py + cH} Z`;

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="relative" style={{ height: 240 }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        {[0, 25, 50, 75, 100].map(v => {
          const y = py + cH - (v / 100) * cH;
          return (
            <g key={v}>
              <line x1={px} y1={y} x2={w - px} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
              <text x={px - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="10">{v}%</text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.06" />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#aGrad)" />
        <path d={line} fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeLinecap="round" />
        {pts.map((p, i) => {
          const dt = new Date(workdays[i].date + 'T12:00:00');
          const day = dayNames[dt.getDay()];
          const isHovered = hoveredPoint === i;
          return (
            <g key={i}>
              {/* Vertical dashed line on hover */}
              {isHovered && (
                <line
                  x1={p.x} y1={p.y} x2={p.x} y2={py + cH}
                  stroke="hsl(var(--foreground))" strokeWidth="1" strokeDasharray="3 3" opacity="0.3"
                />
              )}
              <circle cx={p.x} cy={p.y} r={isHovered ? 4.5 : 3} fill="hsl(var(--background))" stroke="hsl(var(--foreground))" strokeWidth="1.5" style={{ transition: 'r 0.15s' }} />
              <text x={p.x} y={h - 2} textAnchor="middle" className="fill-muted-foreground" fontSize="10">{day}</text>
              {/* Transparent hit area */}
              <circle
                cx={p.x} cy={p.y} r={12} fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </g>
          );
        })}
      </svg>
      {/* Tooltip */}
      {hoveredPoint !== null && (() => {
        const i = hoveredPoint;
        const p = pts[i];
        const dt = new Date(workdays[i].date + 'T12:00:00');
        const day = dayNames[dt.getDay()];
        const tooltipLabel = `${day}, ${dt.getDate()} ${monthNames[dt.getMonth()]}`;
        const pctText = `${Math.round(rates[i])}% (${workdays[i].present}/${workdays[i].total})`;
        // Position tooltip relative to the SVG container
        const xPct = (p.x / w) * 100;
        const yPct = (p.y / h) * 100;
        return (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: 'translate(-50%, -110%)',
            }}
          >
            <div className="bg-card border border-border rounded-md shadow-lg px-2.5 py-1.5 text-center whitespace-nowrap">
              <p className="text-[10px] text-muted-foreground">{tooltipLabel}</p>
              <p className="text-xs font-semibold">{pctText}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export function DashboardClient({ data: initialData }: { data: StatsData }) {
  const [manualOpen, setManualOpen] = useState(false);
  const [classFilter, setClassFilter] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('dashboard_class_filter') || 'all' : 'all'
  );
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d'>('7d');
  const [data, setData] = useState<StatsData>(initialData);

  // KPIs always fetch "today", chart fetches the selected period
  const fetchStats = useCallback(async (cid?: string) => {
    try {
      const params = new URLSearchParams();
      if (cid && cid !== 'all') params.set('classId', cid);
      params.set('period', 'today');
      params.set('trendDays', chartPeriod === '7d' ? '7' : '30');
      const res = await fetch(`/api/dashboard/stats?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
  }, [chartPeriod]);

  useEffect(() => {
    const id = setInterval(() => fetchStats(classFilter), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [classFilter, fetchStats]);

  useEffect(() => { fetchStats(classFilter); }, [classFilter, chartPeriod, fetchStats]);

  // Persist class filter selection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_class_filter', classFilter);
    }
  }, [classFilter]);

  const presenceRate = data.totalStudents > 0
    ? Math.round((data.presentCount / data.totalStudents) * 100) : 0;

  // Calculate trend from chart data
  const trendRates = data.trend?.filter(t => t.total > 0).map(t => Math.round((t.present / t.total) * 100)) ?? [];
  const avgRate = trendRates.length > 0 ? Math.round(trendRates.reduce((a, b) => a + b, 0) / trendRates.length) : 0;

  const today = new Date();

  // Alerts — actionable items
  const alerts: { text: string; href: string; urgent: boolean }[] = [];
  if (data.unrecognizedCount > 0) {
    alerts.push({
      text: `${data.unrecognizedCount} rosto${data.unrecognizedCount > 1 ? 's' : ''} não identificado${data.unrecognizedCount > 1 ? 's' : ''} — revisar`,
      href: '/admin/unrecognized',
      urgent: data.unrecognizedCount >= 5,
    });
  }
  if ((data.lateCount ?? 0) > 3) {
    alerts.push({
      text: `${data.lateCount} atrasos hoje — acima do normal`,
      href: '/admin/attendance',
      urgent: false,
    });
  }

  return (
    <>
      <div className="flex-1 p-5 md:p-8 space-y-6 w-full">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setManualOpen(true)}
              className="hidden md:flex items-center gap-2 h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <ClipboardEdit className="h-3.5 w-3.5" />
              Registrar
            </button>
            <Link
              href="/admin/camera"
              className="flex items-center gap-2 h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              <Video className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Câmera</span>
            </Link>
          </div>
        </motion.div>

        {/* Class filter — applies to everything */}
        {data.classes.length > 0 && (
          <div className="flex items-center">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2.5 pr-7 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="all">Todas as turmas</option>
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <Link key={i} href={alert.href}>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-md border border-border hover:bg-accent transition-colors">
                  <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs">{alert.text}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* KPIs — ALWAYS TODAY */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hoje</h2>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5">
              <span className="text-xs text-muted-foreground">Presentes</span>
              <p className="text-3xl font-semibold tracking-tight mt-2"><AnimatedNumber value={data.presentCount} /></p>
              <p className="text-xs text-muted-foreground mt-1">de {data.totalStudents}</p>
            </Card>
            <Card className="p-5">
              <span className="text-xs text-muted-foreground">Ausentes</span>
              <p className="text-3xl font-semibold tracking-tight mt-2"><AnimatedNumber value={data.absentCount} /></p>
              <p className="text-xs text-muted-foreground mt-1">{data.totalStudents > 0 ? Math.round((data.absentCount / data.totalStudents) * 100) : 0}%</p>
            </Card>
            <Card className="p-5">
              <span className="text-xs text-muted-foreground">Atrasos</span>
              <p className="text-3xl font-semibold tracking-tight mt-2"><AnimatedNumber value={data.lateCount ?? 0} /></p>
              <p className="text-xs text-muted-foreground mt-1">&nbsp;</p>
            </Card>
            <Card className="p-5">
              <span className="text-xs text-muted-foreground">Presença</span>
              <p className="text-3xl font-semibold tracking-tight mt-2">{presenceRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">taxa geral</p>
            </Card>
          </div>
        </motion.div>

        {/* Chart + Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Trend Chart — THIS has period selector */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="lg:col-span-3"
          >
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Tendência de Frequência</h3>
                  {avgRate > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">Média: {avgRate}% nos dias úteis</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(['7d', '30d'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setChartPeriod(p)}
                      className={cn(
                        'h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors',
                        chartPeriod === p ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {p === '7d' ? '7 dias' : '30 dias'}
                    </button>
                  ))}
                </div>
              </div>
              {data.trend && data.trend.some(t => t.total > 0) ? (
                <LineChart data={data.trend} />
              ) : (
                <div className="flex items-center justify-center h-[180px]">
                  <p className="text-xs text-muted-foreground">Sem dados no período</p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Live Feed */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className="lg:col-span-2"
          >
            <Card className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Ao vivo</h3>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <button
                  onClick={() => setManualOpen(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Manual
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[420px]">
                {data.recentEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <p className="text-xs text-muted-foreground">Nenhum evento hoje</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {data.recentEvents.slice(0, 20).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors"
                      >
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarImage src={event.student.photoUrl || ''} />
                          <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
                            {getInitials(event.student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{event.student.name}</p>
                        </div>
                        <span className={cn(
                          'text-[10px]',
                          event.eventType === 'ENTRY' ? 'text-foreground' : 'text-muted-foreground'
                        )}>
                          {event.eventType === 'ENTRY' ? 'Entrada' : 'Saída'}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {new Date(event.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      <ManualCheckinWizard open={manualOpen} onOpenChange={setManualOpen} />
    </>
  );
}
