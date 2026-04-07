'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, LogIn, LogOut, Clock, Calendar,
  UserCheck, UserX, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

interface DayRecord {
  date: string;
  status: 'present' | 'absent' | 'late' | 'early_exit';
  entryTime: string | null;
  exitTime: string | null;
  stayMinutes: number | null;
}

interface StudentHistory {
  student: {
    id: string;
    name: string;
    photoUrl: string | null;
    className: string;
    birthDate: string | null;
  };
  stats: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    avgStayMinutes: number | null;
    frequencyRate: number;
  };
  dailySummary: DayRecord[];
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  present: { label: 'Presente', color: 'text-emerald-600', bg: 'bg-emerald-500' },
  late: { label: 'Atraso', color: 'text-yellow-600', bg: 'bg-yellow-500' },
  absent: { label: 'Ausente', color: 'text-red-500', bg: 'bg-red-400' },
  early_exit: { label: 'Saída antecipada', color: 'text-orange-500', bg: 'bg-orange-500' },
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
}

export default function StudentHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [data, setData] = useState<StudentHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - days);
      const res = await fetch(
        `/api/students/${studentId}/history?from=${from.toISOString().slice(0, 10)}&to=${today.toISOString().slice(0, 10)}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId, days]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-muted-foreground">Aluno não encontrado</p>
        <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
      </div>
    );
  }

  const { student, stats, dailySummary: dayRecords } = data;

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-12 w-12">
          {student.photoUrl && <AvatarImage src={student.photoUrl} alt={student.name} />}
          <AvatarFallback className="text-sm bg-secondary">{getInitials(student.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-lg font-semibold">{student.name}</h1>
          <p className="text-xs text-muted-foreground">{student.className}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Frequência', value: `${stats.frequencyRate}%`, icon: TrendingUp, color: stats.frequencyRate >= 75 ? 'text-emerald-600' : 'text-red-500' },
          { label: 'Presentes', value: stats.presentDays, icon: UserCheck, color: 'text-emerald-600' },
          { label: 'Ausentes', value: stats.absentDays, icon: UserX, color: 'text-red-500' },
          { label: 'Atrasos', value: stats.lateDays, icon: Clock, color: 'text-yellow-600' },
          { label: 'Perm. média', value: stats.avgStayMinutes ? formatMinutes(stats.avgStayMinutes) : '—', icon: Clock, color: '' },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className="flex items-start justify-between mb-1">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <s.icon className="h-3 w-3 text-muted-foreground/40" />
            </div>
            <p className={cn('text-lg font-bold tabular-nums', s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        {[7, 30, 60].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              days === d ? 'bg-primary text-primary-foreground shadow-apple-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {d} dias
          </button>
        ))}
      </div>

      {/* Frequency alert */}
      {stats.frequencyRate < 75 && (
        <Card className="p-3 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700">
              Frequência abaixo do limite legal de 75% (LDB). Aluno em risco de reprovação por falta.
            </p>
          </div>
        </Card>
      )}

      {/* Frequency bar */}
      <Card className="p-4">
        <div className="flex items-center gap-1">
          {dayRecords.slice(-30).map((d) => {
            const dt = new Date(d.date + 'T12:00:00');
            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            const cfg = STATUS_LABELS[d.status] || STATUS_LABELS.absent;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${cfg.label}`}>
                <div
                  className={cn(
                    'w-full h-6 rounded-sm transition-all',
                    isWeekend ? 'bg-border/20' : cfg.bg,
                    isWeekend ? '' : 'opacity-80 hover:opacity-100'
                  )}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', cfg.bg)} />
              {cfg.label}
            </span>
          ))}
        </div>
      </Card>

      {/* Timeline */}
      <Card className="overflow-hidden">
        <CardHeader className="px-4 py-3 border-b border-border">
          <CardTitle className="text-sm">Histórico Diário</CardTitle>
        </CardHeader>
        <div className="divide-y divide-border">
          {dayRecords.filter(d => {
            const dt = new Date(d.date + 'T12:00:00');
            return dt.getDay() !== 0 && dt.getDay() !== 6;
          }).reverse().map((d) => {
            const cfg = STATUS_LABELS[d.status] || STATUS_LABELS.absent;
            const dt = new Date(d.date + 'T12:00:00');
            const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dt.getDay()];
            return (
              <div key={d.date} className="flex items-center gap-3 px-4 py-2.5">
                <div className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.bg)} />
                <div className="w-20 flex-shrink-0">
                  <p className="text-xs font-medium">{dayName}</p>
                  <p className="text-[10px] text-muted-foreground">{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                </div>
                <Badge variant="outline" className={cn('text-[10px]', cfg.color)}>{cfg.label}</Badge>
                <div className="flex-1" />
                {d.entryTime && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <LogIn className="h-2.5 w-2.5" />
                    {formatTime(d.entryTime)}
                  </span>
                )}
                {d.exitTime && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <LogOut className="h-2.5 w-2.5" />
                    {formatTime(d.exitTime)}
                  </span>
                )}
                {d.stayMinutes && d.stayMinutes > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatMinutes(d.stayMinutes)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
