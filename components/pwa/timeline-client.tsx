'use client';

import { useRouter } from 'next/navigation';
import { LogIn, LogOut, Clock, ChevronLeft, CalendarDays } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, getInitials, formatTime } from '@/lib/utils';

interface TimelineClientProps {
  children: any[];
  events: any[];
  selectedStudentId: string | null;
}

function groupEventsByDay(events: any[]) {
  const groups: Record<string, any[]> = {};
  for (const event of events) {
    const day = new Date(event.timestamp).toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
      timeZone: 'America/Sao_Paulo',
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(event);
  }
  return groups;
}

export function TimelineClient({ children, events, selectedStudentId }: TimelineClientProps) {
  const router = useRouter();
  const selected = children.find((c) => c.id === selectedStudentId);
  const grouped = groupEventsByDay(events);
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo',
  });

  function selectStudent(id: string) {
    router.push(`/pwa/timeline?studentId=${id}`);
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent text-muted-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold">Timeline</h1>
        </div>

        {/* Child Selector */}
        {children.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => selectStudent(child.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 flex-shrink-0 transition-colors border text-xs font-medium',
                  selectedStudentId === child.id
                    ? 'bg-accent border-border text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-accent/50'
                )}
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={child.photoUrl || ''} />
                  <AvatarFallback className="text-[8px] bg-secondary">{getInitials(child.name)}</AvatarFallback>
                </Avatar>
                <span>{child.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Selected Student Info */}
      {selected && (
        <div className="mx-4 mt-4 rounded-md border border-border bg-card p-3 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={selected.photoUrl || ''} alt={selected.name} />
            <AvatarFallback className="text-sm font-semibold bg-secondary">{getInitials(selected.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{selected.name}</p>
            <p className="text-xs text-muted-foreground">{selected.class?.name}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>7 dias</span>
          </div>
        </div>
      )}

      {/* Events */}
      <div className="flex-1 px-4 py-4 pb-6">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Clock className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum evento encontrado</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Os eventos aparecerão aqui
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day}>
                {/* Day Header */}
                <div className="flex items-center gap-2 mb-3 py-1 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full flex-shrink-0',
                    day === today ? 'bg-foreground' : 'bg-muted-foreground/40'
                  )} />
                  <span className={cn(
                    'text-xs font-semibold uppercase tracking-wider capitalize',
                    day === today ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {day === today ? 'Hoje' : day}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: any }) {
  const isEntry = event.eventType === 'ENTRY';

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {/* Type indicator */}
        <div className={cn(
          'h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5',
          isEntry ? 'bg-success/10' : 'bg-secondary'
        )}>
          {isEntry
            ? <LogIn className="h-4 w-4 text-success" />
            : <LogOut className="h-4 w-4 text-muted-foreground" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={isEntry ? 'entry' : 'exit'}>
              {isEntry ? 'Entrada' : 'Saída'}
            </Badge>
            {event.isManual && (
              <Badge variant="secondary" className="text-[10px]">Manual</Badge>
            )}
          </div>

          <p className="text-2xl font-semibold tracking-tight tabular-nums mt-1.5">
            {formatTime(event.timestamp)}
          </p>

          <div className="mt-1 space-y-0.5">
            {event.device && (
              <p className="text-xs text-muted-foreground">{event.device.name}</p>
            )}
            {event.confidence && (
              <p className="text-xs text-muted-foreground/50">
                Confiança: {(event.confidence * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {/* Event Photo */}
        {event.photoUrl && (
          <div className="h-14 w-14 rounded-md overflow-hidden flex-shrink-0 border border-border">
            <img
              src={event.photoUrl}
              alt="Foto do evento"
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
}
