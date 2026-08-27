'use client';

import { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
function fmt(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Seletor de período: controle segmentado (rola no celular) + calendário em
 * modal central. Antes o calendário era um dropdown absoluto que estourava a
 * tela e o controle ficava espremido dentro de outro card.
 */
export function PeriodPicker({
  value, onChange, presets = ['7d', '30d', '90d'], tz,
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  presets?: Array<'7d' | '30d' | '90d'>;
  tz?: string;
}) {
  const [open, setOpen] = useState(false);

  const todayStr = tz
    ? new Date().toLocaleDateString('en-CA', { timeZone: tz })
    : toStr(new Date());

  function pickPreset(p: '7d' | '30d' | '90d') {
    const days = p === '7d' ? 6 : p === '30d' ? 29 : 89;
    onChange({ preset: p, from: addDays(todayStr, -days), to: todayStr });
  }

  const presetLabel: Record<string, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias' };
  const customLabel = value.preset === 'custom' ? `${fmt(value.from)} – ${fmt(value.to)}` : 'Escolher';

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-lg bg-secondary p-1">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => pickPreset(p)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors',
              value.preset === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {presetLabel[p]}
          </button>
        ))}
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors',
            value.preset === 'custom' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          {customLabel}
        </button>
      </div>

      {open && (
        <CalendarModal
          from={value.from}
          to={value.to}
          todayStr={todayStr}
          onClose={() => setOpen(false)}
          onApply={(from, to) => { onChange({ preset: 'custom', from, to }); setOpen(false); }}
        />
      )}
    </>
  );
}

function CalendarModal({ from, to, todayStr, onClose, onApply }: { from: string; to: string; todayStr: string; onClose: () => void; onApply: (f: string, t: string) => void }) {
  const [selFrom, setSelFrom] = useState(from);
  const [selTo, setSelTo] = useState(to);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date((to || toStr(new Date())) + 'T12:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  function selectDay(dayStr: string) {
    if (!selFrom || (selFrom && selTo)) { setSelFrom(dayStr); setSelTo(''); return; }
    if (dayStr < selFrom) { setSelTo(selFrom); setSelFrom(dayStr); }
    else setSelTo(dayStr);
  }

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toStr(new Date(year, month, d)));
  const effTo = selTo || selFrom;

  function quick(days: number) {
    setSelFrom(addDays(todayStr, -(days - 1)));
    setSelTo(todayStr);
    const d = new Date(todayStr + 'T12:00:00');
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full sm:max-w-[340px] bg-card border border-border rounded-t-2xl sm:rounded-2xl p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Escolher período</h3>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-1.5 mb-3">
          {[{ l: '7 dias', d: 7 }, { l: '30 dias', d: 30 }, { l: '90 dias', d: 90 }].map((q) => (
            <button key={q.d} onClick={() => quick(q.d)} className="flex-1 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors">{q.l}</button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-medium">{monthNames[month]} {year}</span>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
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
                  'h-9 text-sm rounded-md transition-colors',
                  future && 'opacity-30 cursor-not-allowed',
                  isEdge ? 'bg-foreground text-background font-semibold' : inRange ? 'bg-accent' : 'hover:bg-accent',
                )}
              >
                {parseInt(day.slice(-2), 10)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {selFrom ? fmt(selFrom) : '...'} a {effTo ? fmt(effTo) : '...'}
          </span>
          <button
            disabled={!selFrom}
            onClick={() => onApply(selFrom, effTo)}
            className="px-4 py-1.5 text-sm font-medium rounded-md bg-foreground text-background disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
