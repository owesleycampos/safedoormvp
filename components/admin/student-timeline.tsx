'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogIn, LogOut } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatTime, formatDate } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  eventType: 'ENTRY' | 'EXIT';
  timestamp: string;
  isManual: boolean;
  notes?: string;
}

interface GroupedEvents {
  date: string;
  label: string;
  events: TimelineEvent[];
}

interface StudentTimelineProps {
  studentId: string;
  studentName: string;
}

function groupByDay(events: TimelineEvent[]): GroupedEvents[] {
  const groups: Record<string, TimelineEvent[]> = {};

  for (const event of events) {
    const d = new Date(event.timestamp);
    const key = d.toISOString().split('T')[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, events]) => ({
      date,
      label: formatDate(date, {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }),
      events: events.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    }));
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="ml-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton variant="circle" className="h-7 w-7" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton variant="circle" className="h-7 w-7" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudentTimeline({ studentId, studentName }: StudentTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await fetch(`/api/students/${studentId}/history`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [studentId]);

  if (loading) return <TimelineSkeleton />;

  if (error || events.length === 0) {
    return (
      <EmptyState
        variant="no-events"
        title="Nenhum evento encontrado"
        description={`${studentName} não possui registros nos últimos 30 dias.`}
      />
    );
  }

  const grouped = groupByDay(events);

  return (
    <div className="space-y-6">
      {grouped.map((group, gi) => (
        <div key={group.date}>
          <p className="text-xs font-medium text-muted-foreground mb-3 capitalize">
            {group.label}
          </p>
          <div className="relative ml-3.5">
            {/* Vertical line */}
            <div className="absolute left-[13px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-3">
              {group.events.map((event, ei) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: gi * 0.1 + ei * 0.05,
                    ease: 'easeOut',
                  }}
                  className="flex items-center gap-3 relative"
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border bg-card',
                      'border-border'
                    )}
                  >
                    {event.eventType === 'ENTRY' ? (
                      <LogIn className="h-3.5 w-3.5 text-foreground" />
                    ) : (
                      <LogOut className="h-3.5 w-3.5 text-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {event.eventType === 'ENTRY' ? 'Entrada' : 'Saída'}
                      {event.isManual && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                          (manual)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(event.timestamp)}
                      {event.notes && (
                        <span className="ml-1.5">· {event.notes}</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
