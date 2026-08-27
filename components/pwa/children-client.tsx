'use client';

import Link from 'next/link';
import { Baby, LogIn, LogOut, Clock, Bell, Plus, Award } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { cn, getInitials, formatTime, formatRelativeTime } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { subscribeToPush } from '@/lib/push-client';
import { toast } from '@/components/ui/toaster';

interface ChildrenClientProps {
  children: any[];
}

export function ChildrenClient({ children }: ChildrenClientProps) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [requestingPush, setRequestingPush] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  async function enablePush() {
    setRequestingPush(true);
    try {
      const result = await subscribeToPush();
      if (result.ok) {
        setPushEnabled(true);
        toast({ variant: 'success', title: 'Notificações ativadas!' });
      } else {
        toast({ variant: 'warning', title: result.reason, description: result.hint });
      }
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

        {/* Vincular filho — o vínculo é feito pelo link de convite que a
            escola envia. O antigo código de acesso de 6 caracteres foi
            aposentado: nenhuma tela da escola conseguia gerá-lo. */}
        {showLinkDialog && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Vincular filho(a)</p>
            <p className="text-xs text-muted-foreground">
              A escola envia um link de convite por WhatsApp ou e-mail. Abra esse link
              no celular e escolha seu filho(a) na lista da turma.
            </p>
            <p className="text-xs text-muted-foreground">
              Ainda não recebeu? Fale com a secretaria da escola e peça o link de vinculação.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowLinkDialog(false)}
            >
              Entendi
            </Button>
          </div>
        )}

        {/* Children */}
        {children.length === 0 && !showLinkDialog ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <Baby className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum filho vinculado</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Abra o link de convite que a escola enviou para vincular seu filho(a).
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowLinkDialog(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Como vincular?
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child, index) => (
              <ChildCard key={child.id} child={child} index={index} />
            ))}

            {/* Add another child button */}
            {!showLinkDialog && (
              <button
                type="button"
                onClick={() => setShowLinkDialog(true)}
                className="w-full flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-left hover:bg-accent/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vincular outro filho(a)</p>
                  <p className="text-xs text-muted-foreground/60">Pelo link de convite da escola</p>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChildCard({ child, index }: { child: any; index: number }) {
  const lastEvent = child.lastEvent;
  const isPresent = lastEvent?.eventType === 'ENTRY';
  const hasLeft  = lastEvent?.eventType === 'EXIT';
  const weeklyAttendance = child.weeklyAttendance as { label: string; present: boolean | null }[] | undefined;
  const weeklyPercentage = child.weeklyPercentage as number | null | undefined;
  const hasWeekly = weeklyPercentage != null;
  const perfectMonth = child.perfectMonth as boolean | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
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
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-semibold truncate">{child.name}</p>
                  {perfectMonth && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.4 + index * 0.08 }}
                      title="Presenca Exemplar este mes"
                    >
                      <Award className="h-3.5 w-3.5 text-foreground flex-shrink-0" />
                    </motion.span>
                  )}
                </div>
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

          {/* Weekly attendance summary */}
          {weeklyAttendance && weeklyAttendance.length > 0 && (
            <div className="px-4 pb-3.5 pt-0">
              <div className="rounded-md bg-secondary/40 px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Esta semana
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {hasWeekly ? `${weeklyPercentage}%` : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {weeklyAttendance.map((day, i) => (
                    <div key={day.label} className="flex flex-col items-center gap-1 flex-1">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 + i * 0.06, type: 'spring', stiffness: 500, damping: 25 }}
                        className={cn(
                          'h-2 w-2 rounded-full',
                          day.present === null
                            ? 'bg-muted-foreground/10'
                            : day.present
                            ? 'bg-foreground'
                            : 'bg-muted-foreground/25'
                        )}
                      />
                      <span className={cn(
                        'text-[9px]',
                        day.present === null
                          ? 'text-muted-foreground/30'
                          : day.present
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground/50'
                      )}>
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
                {perfectMonth && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50"
                  >
                    <Award className="h-3 w-3 text-foreground" />
                    <span className="text-[10px] font-medium text-foreground">
                      Presenca Exemplar
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
