'use client';

import Link from 'next/link';
import { Baby, LogIn, LogOut, Clock, Bell } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { cn, getInitials, formatTime, formatRelativeTime } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface ChildrenClientProps {
  children: any[];
}

export function ChildrenClient({ children }: ChildrenClientProps) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [requestingPush, setRequestingPush] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setRequestingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      setPushEnabled(true);
    } finally {
      setRequestingPush(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">
      {/* Top Nav */}
      <header className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-border">
        <Logo size="xs" showText />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {!pushEnabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={enablePush}
              loading={requestingPush}
              className="h-8 w-8 text-muted-foreground"
              title="Ativar notificações"
            >
              <Bell className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-4 py-5 space-y-5">
        <div>
          <h1 className="text-lg font-semibold">Meus Filhos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Frequência em tempo real
          </p>
        </div>

        {/* Push notification banner */}
        {!pushEnabled && (
          <button
            type="button"
            onClick={enablePush}
            className="w-full flex items-center gap-3 rounded-md border border-border bg-secondary/40 p-3.5 text-left hover:bg-accent transition-colors"
          >
            <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Ativar Notificações</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receba alertas de entrada e saída
              </p>
            </div>
          </button>
        )}

        {/* Children */}
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <Baby className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum filho vinculado</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Entre em contato com a escola para vincular.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <ChildCard key={child.id} child={child} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChildCard({ child }: { child: any }) {
  const lastEvent = child.lastEvent;
  const isPresent = lastEvent?.eventType === 'ENTRY';
  const hasLeft  = lastEvent?.eventType === 'EXIT';

  return (
    <Link href={`/pwa/timeline?studentId=${child.id}`}>
      <div className="group rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors overflow-hidden active:scale-[0.99]">
        {/* Status stripe */}
        <div className={cn(
          'h-0.5',
          isPresent ? 'bg-success' : hasLeft ? 'bg-muted-foreground/40' : 'bg-transparent'
        )} />

        <div className="p-4 flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar className="h-12 w-12">
              <AvatarImage src={child.photoUrl || ''} alt={child.name} className="object-cover" />
              <AvatarFallback className="text-base font-semibold bg-secondary">
                {getInitials(child.name)}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
              isPresent ? 'bg-success' : hasLeft ? 'bg-muted-foreground/50' : 'bg-muted-foreground/20'
            )} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold truncate">{child.name}</p>
              <Badge variant={isPresent ? 'entry' : hasLeft ? 'exit' : 'secondary'} className="flex-shrink-0">
                {isPresent ? 'Na escola' : hasLeft ? 'Saiu' : 'Sem registro'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{child.class?.name}</p>

            {lastEvent ? (
              <p className="text-xs text-muted-foreground mt-1.5">
                {isPresent ? 'Entrou' : 'Saiu'} às{' '}
                <span className="font-medium text-foreground">{formatTime(lastEvent.timestamp)}</span>
                {' · '}{formatRelativeTime(lastEvent.timestamp)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5">Nenhum registro hoje</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
