'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import {
  LogIn, LogOut, Clock, Shield, Loader2,
  CheckCircle2, XCircle, AlertTriangle, UserCheck,
  Settings, LogOut as LogOutIcon, Bell,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/lib/utils';

interface ChildData {
  id: string;
  name: string;
  photoUrl: string | null;
  className: string;
  relationship: string;
  today: {
    status: string;
    entryTime: string | null;
    exitTime: string | null;
    isLate: boolean;
  };
  weekHistory: { date: string; status: string }[];
  frequencyRate: number;
}

interface ParentData {
  parentName: string;
  children: ChildData[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  present: { label: 'Na escola', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  late: { label: 'Atrasado', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
  absent: { label: 'Não chegou', icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  left: { label: 'Saiu da escola', icon: LogOut, color: 'text-blue-600', bg: 'bg-blue-500/10' },
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function ParentDashboard() {
  const [data, setData] = useState<ParentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/parent/dashboard');
        if (res.ok) setData(await res.json());
      } catch {} finally {
        setLoading(false);
      }
    }
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Shield className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{greeting},</p>
                <p className="text-sm font-semibold">{data?.parentName || 'Responsável'}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => signOut({ callbackUrl: '/auth/login' })}>
              <LogOutIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Date */}
        <p className="text-xs text-muted-foreground capitalize">
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {!data || data.children.length === 0 ? (
          <Card className="p-8 text-center">
            <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhum aluno vinculado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Peça à escola para enviar o link de vinculação.
            </p>
          </Card>
        ) : (
          data.children.map((child) => {
            const cfg = STATUS_CONFIG[child.today.status] || STATUS_CONFIG.absent;
            const Icon = cfg.icon;

            return (
              <Card key={child.id} className="overflow-hidden">
                {/* Child header */}
                <div className="p-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                        {child.photoUrl && <AvatarImage src={child.photoUrl} alt={child.name} />}
                        <AvatarFallback className="text-lg bg-secondary">
                          {getInitials(child.name)}
                        </AvatarFallback>
                      </Avatar>
                      {/* Status dot */}
                      <span className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card flex items-center justify-center',
                        child.today.status === 'present' || child.today.status === 'late' ? 'bg-emerald-500' :
                          child.today.status === 'left' ? 'bg-blue-500' : 'bg-red-400'
                      )}>
                        <Icon className="h-2.5 w-2.5 text-white" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold truncate">{child.name}</p>
                      <p className="text-xs text-muted-foreground">{child.className}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{child.relationship}</Badge>
                  </div>
                </div>

                {/* Today status */}
                <div className={cn('px-4 py-3 mx-3 rounded-lg mb-3', cfg.bg)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', cfg.color)} />
                      <span className={cn('text-sm font-medium', cfg.color)}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {child.today.entryTime && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <LogIn className="h-3 w-3" />
                          {formatTime(child.today.entryTime)}
                        </span>
                      )}
                      {child.today.exitTime && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <LogOut className="h-3 w-3" />
                          {formatTime(child.today.exitTime)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Week history */}
                <div className="px-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-muted-foreground font-medium">Últimos 7 dias</p>
                    <span className={cn(
                      'text-xs font-bold',
                      child.frequencyRate >= 75 ? 'text-emerald-600' :
                        child.frequencyRate >= 50 ? 'text-yellow-600' : 'text-red-500'
                    )}>
                      {child.frequencyRate}% freq.
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {child.weekHistory.map((d) => {
                      const dt = new Date(d.date + 'T12:00:00');
                      const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
                      const isToday = d.date === now.toISOString().slice(0, 10);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-muted-foreground">{dayNames[dt.getDay()]}</span>
                          <div className={cn(
                            'w-full aspect-square max-w-[32px] rounded-md flex items-center justify-center transition-all',
                            d.status === 'weekend' ? 'bg-border/20' :
                              d.status === 'present' ? 'bg-emerald-500' :
                              d.status === 'late' ? 'bg-yellow-500' : 'bg-red-400/60',
                            isToday && 'ring-2 ring-foreground/20'
                          )}>
                            {d.status !== 'weekend' && (
                              <span className="text-[10px] text-white font-medium">
                                {d.status === 'present' ? 'P' : d.status === 'late' ? 'A' : 'F'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Frequency alert */}
                {child.frequencyRate < 75 && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
                      <p className="text-[11px] text-yellow-700">
                        Frequência abaixo de 75%. Converse com a escola.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground/60">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-[10px]">Safe Door Brasil</span>
          </div>
        </div>
      </div>
    </div>
  );
}
