'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserCheck, UserX, Eye, LogIn, LogOut, Clock, ClipboardEdit,
  TrendingUp, TrendingDown, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ManualCheckinWizard } from '@/components/admin/manual-checkin-wizard';
import { AdminHeader } from '@/components/admin/header';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';

interface TrendPoint {
  date: string;
  present: number;
  total: number;
}

interface StatsData {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount?: number;
  recentEvents: any[];
  unrecognizedCount: number;
  classes: { id: string; name: string }[];
  trend?: TrendPoint[];
  avgStayMinutes?: number | null;
}

interface DashboardClientProps {
  data: StatsData;
}

const POLL_INTERVAL_MS = 15_000;

function Sparkline({ data, color = 'currentColor' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const h = 28;
  const w = 80;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-7" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
}

export function DashboardClient({ data: initialData }: DashboardClientProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [classFilter, setClassFilter] = useState('all');
  const [data, setData] = useState<StatsData>(initialData);

  const fetchStats = useCallback(async (cid?: string) => {
    try {
      const params = new URLSearchParams();
      if (cid && cid !== 'all') params.set('classId', cid);
      const res = await fetch(`/api/dashboard/stats?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // silent — keep stale data
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => fetchStats(classFilter), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [classFilter, fetchStats]);

  useEffect(() => {
    fetchStats(classFilter);
  }, [classFilter, fetchStats]);

  const presenceRate = data.totalStudents > 0
    ? Math.round((data.presentCount / data.totalStudents) * 100) : 0;

  const trendData = data.trend?.map(t => t.present) ?? [];
  const trendRates = data.trend?.filter(t => t.total > 0).map(t => Math.round((t.present / t.total) * 100)) ?? [];
  const yesterdayRate = trendRates.length >= 2 ? trendRates[trendRates.length - 2] : null;
  const trendDirection = yesterdayRate !== null ? presenceRate - yesterdayRate : 0;

  return (
    <>
      <AdminHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setManualOpen(true)}>
            <ClipboardEdit className="h-4 w-4" />
            <span className="hidden sm:inline">Registrar Manualmente</span>
            <span className="sm:hidden">Registrar</span>
          </Button>
        }
      />

      <div className="flex-1 p-4 md:p-6 space-y-6">

        {/* Class filter */}
        {data.classes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Turma:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setClassFilter('all')}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  classFilter === 'all'
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                Todas
              </button>
              {data.classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setClassFilter(c.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    classFilter === c.id
                      ? 'bg-foreground text-background'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Presentes */}
          <Card>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground">Presentes</p>
                <UserCheck className="h-4 w-4 text-emerald-500/60" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="metric-number">{data.presentCount}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">{presenceRate}%</span>
                    {trendDirection !== 0 && (
                      <span className={cn('text-[10px] flex items-center', trendDirection > 0 ? 'text-emerald-500' : 'text-red-500')}>
                        {trendDirection > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(trendDirection)}%
                      </span>
                    )}
                  </div>
                </div>
                {trendData.length >= 2 && <Sparkline data={trendData} color="#10B981" />}
              </div>
              <div className="mt-3 h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-700 rounded-full"
                  style={{ width: `${presenceRate}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Ausentes */}
          <Card>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground">Ausentes</p>
                <UserX className="h-4 w-4 text-red-500/60" />
              </div>
              <p className="metric-number">{data.absentCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalStudents > 0 ? Math.round((data.absentCount / data.totalStudents) * 100) : 0}% do total
              </p>
            </CardContent>
          </Card>

          {/* Atrasos */}
          <Card>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground">Atrasos Hoje</p>
                <Clock className="h-4 w-4 text-yellow-500/60" />
              </div>
              <p className="metric-number">{data.lateCount ?? 0}</p>
              {data.avgStayMinutes && (
                <p className="text-xs text-muted-foreground mt-1">
                  Perm. média: {formatMinutes(data.avgStayMinutes)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Não Identificados */}
          <Card>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground">Não Identificados</p>
                <Eye className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <p className="metric-number">{data.unrecognizedCount}</p>
              {data.unrecognizedCount > 0 && (
                <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Requer revisão
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trend chart (larger) */}
        {data.trend && data.trend.some(t => t.total > 0) && (
          <Card>
            <CardHeader className="px-5 py-4 border-b border-border">
              <CardTitle className="text-sm">Frequência - Últimos 7 dias</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-end gap-2 h-24">
                {data.trend.map((t, i) => {
                  const isWeekend = new Date(t.date + 'T12:00:00').getDay() % 6 === 0;
                  const rate = t.total > 0 ? (t.present / t.total) * 100 : 0;
                  const dt = new Date(t.date + 'T12:00:00');
                  const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dt.getDay()];
                  return (
                    <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: '72px' }}>
                        {isWeekend ? (
                          <div className="w-full max-w-[32px] h-1 rounded-full bg-border/40" />
                        ) : (
                          <div
                            className={cn(
                              'w-full max-w-[32px] rounded-t-md transition-all',
                              rate >= 75 ? 'bg-emerald-500' : rate >= 50 ? 'bg-yellow-500' : rate > 0 ? 'bg-red-400' : 'bg-border/40'
                            )}
                            style={{ height: `${Math.max(rate * 0.72, 2)}px` }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{dayName}</span>
                      {!isWeekend && t.total > 0 && (
                        <span className="text-[10px] font-medium">{Math.round(rate)}%</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <CardTitle>Eventos Recentes</CardTitle>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManualOpen(true)}
              className="gap-1.5 h-7 text-xs text-muted-foreground"
            >
              <ClipboardEdit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Registrar manual</span>
            </Button>
          </CardHeader>

          {data.recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-4 md:px-5 py-3 table-row-hover"
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={event.student.photoUrl || ''} alt={event.student.name} />
                    <AvatarFallback className="text-[10px] bg-secondary">
                      {getInitials(event.student.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.student.class?.name}
                      {event.isManual && <span className="ml-1.5 opacity-60">· Manual</span>}
                      {event.notes?.includes('ATRASO') && (
                        <span className="ml-1.5 text-yellow-600">· Atraso</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                    <Badge variant={event.eventType === 'ENTRY' ? 'entry' : 'exit'}>
                      <span className="hidden sm:inline">{event.eventType === 'ENTRY' ? 'Entrada' : 'Saída'}</span>
                      <span className="sm:hidden">
                        {event.eventType === 'ENTRY'
                          ? <LogIn className="h-3 w-3" />
                          : <LogOut className="h-3 w-3" />
                        }
                      </span>
                    </Badge>
                    <span className="text-xs text-muted-foreground w-14 md:w-16 text-right">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ManualCheckinWizard open={manualOpen} onOpenChange={setManualOpen} />
    </>
  );
}
