'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, UserCheck, UserX, Clock, LogIn, LogOut,
  Loader2, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, MinusCircle, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toaster';
import { cn, getInitials } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'late' | 'early_exit' | 'left';

interface StudentRow {
  id: string;
  name: string;
  photoUrl: string | null;
  className: string;
  classId: string;
  status: 'present' | 'absent' | 'left' | 'entry_only';
  entryTime: string | null;
  entryManual: boolean;
  entryNotes: string | null;
  exitTime: string | null;
  exitManual: boolean;
  exitNotes: string | null;
  entryEventId: string | null;
  exitEventId: string | null;
}

interface DailyData {
  date: string;
  summary: { total: number; present: number; absent: number; left: number; entryOnly: number };
  students: StudentRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isLate(notes: string | null) { return notes?.includes('ATRASO') || notes?.includes('Atraso'); }
function isEarlyExit(notes: string | null) { return notes?.includes('SAIDA_ANTECIPADA') || notes?.includes('antecipada'); }

function getEffectiveStatus(s: StudentRow): AttendanceStatus {
  if (!s.entryTime) return 'absent';
  if (isLate(s.entryNotes)) return 'late';
  if (s.exitTime && isEarlyExit(s.exitNotes)) return 'early_exit';
  if (s.exitTime) return 'left';
  return 'present';
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; border: string; icon: React.ElementType; iconColor: string }> = {
  present:    { label: 'Presente',         color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', border: 'border-l-emerald-500',  icon: CheckCircle2,  iconColor: 'text-emerald-500' },
  late:       { label: 'Atraso',           color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',   border: 'border-l-yellow-500',   icon: Clock,         iconColor: 'text-yellow-500' },
  absent:     { label: 'Ausente',          color: 'bg-red-500/10 text-red-700 dark:text-red-400',            border: 'border-l-red-500',      icon: MinusCircle,   iconColor: 'text-red-500' },
  left:       { label: 'Saiu',             color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',         border: 'border-l-blue-500',     icon: LogOut,        iconColor: 'text-blue-500' },
  early_exit: { label: 'Saída antecipada', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',  border: 'border-l-orange-500',   icon: AlertTriangle, iconColor: 'text-orange-500' },
};

// ─── Time Picker Dialog ──────────────────────────────────────────────────────

interface TimePickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (time: string) => void;
  title: string;
}

function TimePicker({ open, onClose, onConfirm, title }: TimePickerProps) {
  const now = new Date();
  const [time, setTime] = useState(
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 w-[280px] space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold">{title}</p>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="flex-1" onClick={() => { onConfirm(time); onClose(); }}>Confirmar</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Status change menu ───────────────────────────────────────────────────────

interface StatusMenuProps {
  student: StudentRow;
  isToday: boolean;
  onAction: (studentId: string, action: string, entryEventId?: string | null, time?: string) => Promise<void>;
  busy: boolean;
  currentDate: string;
}

function StatusMenu({ student, isToday, onAction, busy, currentDate }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [timePicker, setTimePicker] = useState<{ action: string; title: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const status = getEffectiveStatus(student);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const actions = [
    { key: 'ENTRY',           label: 'Marcar Presente',        show: status === 'absent' },
    { key: 'LATE',            label: 'Marcar Atraso',          show: status === 'absent' || status === 'present' },
    { key: 'EXIT',            label: 'Registrar Saída',        show: status === 'present' || status === 'late' },
    { key: 'EARLY_EXIT',      label: 'Saída Antecipada',       show: status === 'present' || status === 'late' },
    { key: 'DELETE_ENTRY',    label: 'Anular Entrada',         show: status !== 'absent' },
    { key: 'DELETE_EXIT',     label: 'Anular Saída',           show: status === 'left' || status === 'early_exit' },
  ].filter(a => a.show);

  const timeActions = ['ENTRY', 'LATE', 'EXIT', 'EARLY_EXIT'];
  const timeLabels: Record<string, string> = {
    ENTRY: 'Horário da entrada',
    LATE: 'Horário do atraso',
    EXIT: 'Horário da saída',
    EARLY_EXIT: 'Horário da saída',
  };

  function handleMenuAction(action: string) {
    setOpen(false);
    if (timeActions.includes(action)) {
      setTimePicker({ action, title: timeLabels[action] });
    } else {
      onAction(student.id, action, student.entryEventId);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
          cfg.color,
          'hover:opacity-80 active:opacity-60'
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className={cn('h-3 w-3', cfg.iconColor)} />}
        <span>{cfg.label}</span>
        {isToday && <ChevronDown className="h-3 w-3 opacity-60" />}
      </button>

      {open && isToday && actions.length > 0 && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-card shadow-lg py-1">
          {actions.map(a => (
            <button
              key={a.key}
              onClick={() => handleMenuAction(a.key)}
              className="w-full text-left px-4 py-2 text-xs hover:bg-accent transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <TimePicker
        open={!!timePicker}
        onClose={() => setTimePicker(null)}
        onConfirm={(time) => {
          if (timePicker) {
            const timestamp = `${currentDate}T${time}:00`;
            onAction(student.id, timePicker.action, student.entryEventId, timestamp);
          }
        }}
        title={timePicker?.title || ''}
      />
    </div>
  );
}

// ─── Daily Tab ───────────────────────────────────────────────────────────────

export default function DailyTab() {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [date, setDate] = useState(today);
  const [classFilter, setClassFilter] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('daily_class') || 'all') : 'all'
  );
  const [search, setSearch] = useState('');
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyStudent, setBusyStudent] = useState<string | null>(null);

  const dateStr = date.toISOString().slice(0, 10);
  const isToday = dateStr === today.toISOString().slice(0, 10);

  useEffect(() => {
    if (classFilter !== 'all') localStorage.setItem('daily_class', classFilter);
    else localStorage.removeItem('daily_class');
  }, [classFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: dateStr });
      if (classFilter !== 'all') params.set('classId', classFilter);
      const res = await fetch(`/api/reports/daily?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateStr, classFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [isToday, fetchData]);

  const classes = data
    ? Array.from(new Map(data.students.map(s => [s.classId, s.className])).entries()).sort((a, b) => a[1].localeCompare(b[1]))
    : [];

  const filtered = (data?.students ?? [])
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const stats = {
    total: filtered.length,
    present: filtered.filter(s => ['present', 'late', 'left', 'early_exit'].includes(getEffectiveStatus(s))).length,
    absent: filtered.filter(s => getEffectiveStatus(s) === 'absent').length,
    late: filtered.filter(s => getEffectiveStatus(s) === 'late').length,
  };

  async function handleAction(studentId: string, action: string, entryEventId?: string | null, timestamp?: string) {
    setBusyStudent(studentId);
    try {
      if (action === 'DELETE_ENTRY' && entryEventId) {
        const res = await fetch('/api/events/manual', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: entryEventId }),
        });
        if (res.ok) { toast({ variant: 'success', title: 'Entrada removida' }); fetchData(); }
        return;
      }

      if (action === 'DELETE_EXIT') {
        const student = data?.students.find(s => s.id === studentId);
        if (student?.exitEventId) {
          const res = await fetch('/api/events/manual', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: student.exitEventId }),
          });
          if (res.ok) { toast({ variant: 'success', title: 'Saída removida' }); fetchData(); }
        }
        return;
      }

      const payloadMap: Record<string, { eventType: string; notes?: string; override?: boolean }> = {
        ENTRY:      { eventType: 'ENTRY' },
        LATE:       { eventType: 'ENTRY', notes: 'ATRASO', override: true },
        EXIT:       { eventType: 'EXIT' },
        EARLY_EXIT: { eventType: 'EXIT', notes: 'SAIDA_ANTECIPADA' },
      };

      const payload = payloadMap[action];
      if (!payload) return;

      const body: Record<string, any> = { studentId, ...payload };
      if (timestamp) body.timestamp = timestamp;

      const res = await fetch('/api/events/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const d = await res.json();
      if (d.success) {
        const labels: Record<string, string> = { ENTRY: 'Entrada registrada', LATE: 'Atraso registrado', EXIT: 'Saída registrada', EARLY_EXIT: 'Saída antecipada' };
        toast({ variant: 'success', title: labels[action] });
        fetchData();
      } else if (d.skipped) {
        toast({ variant: 'warning', title: d.reason });
      } else {
        toast({ variant: 'destructive', title: d.error || 'Erro ao registrar' });
      }
    } finally {
      setBusyStudent(null);
    }
  }

  const dayLabel = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3">

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Date navigator */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 self-start">
          <button onClick={() => setDate(d => addDays(d, -1))} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date" value={dateStr}
            onChange={e => setDate(new Date(e.target.value + 'T00:00:00'))}
            className="h-8 bg-transparent px-1 text-xs text-foreground focus:outline-none w-[120px]"
          />
          <button onClick={() => setDate(d => addDays(d, 1))} disabled={isToday} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {!isToday && (
          <Button variant="ghost" size="sm" className="text-xs self-start" onClick={() => setDate(new Date())}>Hoje</Button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-shrink-0"
        >
          <option value="all">Todas as turmas</option>
          {classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        <input
          type="text"
          placeholder="Buscar aluno..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-[160px]"
        />
      </div>

      {/* Day label */}
      <p className="text-xs text-muted-foreground capitalize">{dayLabel}</p>

      {/* Summary bar */}
      {!loading && data && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total',     value: stats.total,   color: '' },
            { label: 'Presentes', value: stats.present, color: 'text-emerald-600' },
            { label: 'Ausentes',  value: stats.absent,  color: 'text-red-500' },
            { label: 'Atrasos',   value: stats.late,    color: 'text-yellow-600' },
          ].map(s => (
            <Card key={s.label} className="p-2.5 md:p-3 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground">{s.label}</p>
              <p className={cn('text-lg md:text-xl font-bold tabular-nums', s.color)}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && filtered.length > 0 && isToday && (
        <p className="text-[11px] text-muted-foreground">
          Toque no status do aluno para alterar. Um seletor de horário permite definir o momento exato.
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((s) => {
              const status = getEffectiveStatus(s);
              const cfg = STATUS_CONFIG[status];
              const isBusy = busyStudent === s.id;

              return (
                <div
                  key={s.id}
                  className={cn('flex items-center gap-3 px-3 md:px-4 py-2.5 border-l-4 transition-colors', cfg.border)}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-[10px] bg-secondary">{getInitials(s.name)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {s.entryTime && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <LogIn className="h-2.5 w-2.5" />
                          {formatTime(s.entryTime)}
                          {s.entryManual && <span className="text-[9px] opacity-60">(M)</span>}
                        </span>
                      )}
                      {s.exitTime && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <LogOut className="h-2.5 w-2.5" />
                          {formatTime(s.exitTime)}
                          {s.exitManual && <span className="text-[9px] opacity-60">(M)</span>}
                        </span>
                      )}
                      {!s.entryTime && (
                        <span className="text-[10px] text-muted-foreground">Não registrado</span>
                      )}
                    </div>
                  </div>

                  <StatusMenu
                    student={s}
                    isToday={isToday}
                    onAction={handleAction}
                    busy={isBusy}
                    currentDate={dateStr}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Users className="h-10 w-10 text-muted-foreground/20" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum aluno encontrado</p>
            {classFilter === 'all' && (
              <p className="text-xs text-muted-foreground/60 mt-1">Selecione uma turma para começar</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
