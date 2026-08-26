'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PeriodValue {
  preset: '7d' | '30d' | '90d' | 'custom';
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(base: string, n: number) {
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toStr(d);
}

/** Presets rápidos + calendário para período personalizado. Reutilizável. */
export function PeriodPicker({
  value, onChange, presets = ['7d', '30d', '90d'],
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  presets?: Array<'7d' | '30d' | '90d'>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pickPreset(p: '7d' | '30d' | '90d') {
    const today = toStr(new Date());
    const days = p === '7d' ? 6 : p === '30d' ? 29 : 89;
    onChange({ preset: p, from: addDays(today, -days), to: today });
  }

  const label = value.preset === 'custom'
    ? `${new Date(value.from + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(value.to + 'T12:00:00').toLocaleDateString('pt-BR')}`
    : value.preset === '7d' ? '7 dias' : value.preset === '30d' ? '30 dias' : '90 dias';

  const presetLabel: Record<string, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias' };

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
      {presets.map((p) => (
        <button
          key={p}
          onClick={() => pickPreset(p)}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded transition-colors',
            value.preset === p ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {presetLabel[p]}
        </button>
      ))}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
            value.preset === 'custom' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          {value.preset === 'custom' ? label : 'Personalizado'}
        </button>
        {open && (
          <CalendarPopover
            from={value.from}
            to={value.to}
            onApply={(from, to) => { onChange({ preset: 'custom', from, to }); setOpen(false); }}
          />
        )}
      </div>
    </div>
  );
}

function CalendarPopover({ from, to, onApply }: { from: string; to: string; onApply: (f: string, t: string) => void }) {
  const [selFrom, setSelFrom] = useState(from);
  const [selTo, setSelTo] = useState(to);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(to + 'T12:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  function selectDay(dayStr: string) {
    // Primeiro clique fixa o início; segundo fecha o intervalo.
    if (!selFrom || (selFrom && selTo)) { setSelFrom(dayStr); setSelTo(''); return; }
    if (dayStr < selFrom) { setSelTo(selFrom); setSelFrom(dayStr); }
    else setSelTo(dayStr);
  }

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toStr(new Date());
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toStr(new Date(year, month, d)));

  const effTo = selTo || selFrom;

  return (
    <div className="absolute right-0 top-full mt-1.5 z-50 w-[280px] rounded-lg border border-border bg-card p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-medium">{monthNames[month]} {year}</span>
        <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => <span key={i} className="text-[10px] text-muted-foreground py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const inRange = selFrom && effTo && day >= selFrom && day <= effTo;
          const isEdge = day === selFrom || day === effTo;
          const future = day > todayStr;
          return (
            <button
              key={i}
              disabled={future}
              onClick={() => selectDay(day)}
              className={cn(
                'h-8 text-xs rounded-md transition-colors',
                future && 'opacity-30 cursor-not-allowed',
                isEdge ? 'bg-foreground text-background font-semibold' : inRange ? 'bg-accent' : 'hover:bg-accent',
              )}
            >
              {parseInt(day.slice(-2), 10)}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <span className="text-[11px] text-muted-foreground">
          {selFrom ? new Date(selFrom + 'T12:00:00').toLocaleDateString('pt-BR') : '...'}
          {' a '}
          {effTo ? new Date(effTo + 'T12:00:00').toLocaleDateString('pt-BR') : '...'}
        </span>
        <button
          disabled={!selFrom}
          onClick={() => onApply(selFrom, effTo)}
          className="px-3 py-1 text-xs font-medium rounded-md bg-foreground text-background disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
