'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserCheck, UserX, Eye, LogIn, LogOut, Clock, ClipboardEdit,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ManualCheckinWizard } from '@/components/admin/manual-checkin-wizard';
import { AdminHeader } from '@/components/admin/header';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';

interface StatsData {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  recentEvents: any[];
  unrecognizedCount: number;
  classes: { id: string; name: string }[];
}

interface DashboardClientProps {
  data: StatsData;
}

const POLL_INTERVAL_MS = 15_000;

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

  // Poll every 15 seconds for real-time updates
  useEffect(() => {
    const id = setInterval(() => fetchStats(classFilter), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [classFilter, fetchStats]);

  // Re-fetch when filter changes
  useEffect(() => {
    fetchStats(classFilter);
  }, [classFilter, fetchStats]);

  const presenceRate = data.totalStudents > 0
    ? Math.round((data.presentCount / data.totalStudents) * 100) : 0;

  const metrics = [
    { label: 'Total de Alunos',   value: data.totalStudents,     icon: Users,     sub: null },
    { label: 'Presentes',         value: data.presentCount,      icon: UserCheck, sub: `${presenceRate}% presença` },
    { label: 'Ausentes',          value: data.absentCount,       icon: UserX,     sub: null },
    { label: 'Não Identificados', value: data.unrecognizedCount, icon: Eye,       sub: data.unrecognizedCount > 0 ? 'Requer revisão' : null },
  ];

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
          {metrics.map((m) => (
            <Card key={m.label}>
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <m.icon className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <p className="metric-number">{m.value}</p>
                {m.sub && (
                  <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
                )}
                {m.label === 'Presentes' && (
                  <div className="mt-3 h-px bg-border overflow-hidden">
                    <div
                      className="h-full bg-foreground/40 transition-all duration-700"
                      style={{ width: `${presenceRate}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent events — full width, real-time */}
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
