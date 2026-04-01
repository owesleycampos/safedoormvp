'use client';

import { useState } from 'react';
import {
  Users, UserCheck, UserX, Eye, Monitor, LogIn, LogOut, Clock, ClipboardEdit,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ManualCheckinWizard } from '@/components/admin/manual-checkin-wizard';
import { AdminHeader } from '@/components/admin/header';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';

interface DashboardClientProps {
  data: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    recentEvents: any[];
    deviceStatuses: any[];
    unrecognizedCount: number;
  };
}

export function DashboardClient({ data }: DashboardClientProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const presenceRate = data.totalStudents > 0
    ? Math.round((data.presentCount / data.totalStudents) * 100) : 0;

  const metrics = [
    { label: 'Total de Alunos',    value: data.totalStudents,     icon: Users,     sub: null },
    { label: 'Presentes',          value: data.presentCount,      icon: UserCheck, sub: `${presenceRate}% presença` },
    { label: 'Ausentes',           value: data.absentCount,       icon: UserX,     sub: null },
    { label: 'Não Identificados',  value: data.unrecognizedCount, icon: Eye,       sub: data.unrecognizedCount > 0 ? 'Requer revisão' : null },
  ];

  return (
    <>
    <AdminHeader
      title="Dashboard"
      subtitle={`${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setManualOpen(true)}>
          <ClipboardEdit className="h-4 w-4" />
          <span className="hidden sm:inline">Registrar Manualmente</span>
          <span className="sm:hidden">Registrar</span>
        </Button>
      }
    />
    <div className="flex-1 p-4 md:p-6">
    <div className="space-y-6">

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Recent Events */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between px-5 py-4 border-b border-border">
            <CardTitle>Eventos Recentes</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManualOpen(true)}
              className="gap-1.5 h-7 text-xs text-muted-foreground"
            >
              <ClipboardEdit className="h-3.5 w-3.5" />
              Registrar manual
            </Button>
          </CardHeader>

          {data.recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum evento hoje</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-5 py-3 table-row-hover"
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
                      {event.isManual && <span className="ml-1.5">· Manual</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={event.eventType === 'ENTRY' ? 'entry' : 'exit'}>
                      {event.eventType === 'ENTRY' ? 'Entrada' : 'Saída'}
                    </Badge>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Column */}
        <div className="space-y-4">

          {/* Devices */}
          <Card>
            <CardHeader className="px-5 py-4 border-b border-border flex flex-row items-center gap-2">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              <CardTitle>Dispositivos</CardTitle>
            </CardHeader>
            <div className="divide-y divide-border">
              {data.deviceStatuses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum dispositivo cadastrado
                </p>
              ) : (
                data.deviceStatuses.map((device) => (
                  <div key={device.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={cn(
                      'h-1.5 w-1.5 rounded-full flex-shrink-0',
                      device.status === 'ONLINE' ? 'bg-success' :
                      device.status === 'ERROR'  ? 'bg-danger'  : 'bg-muted-foreground/40'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{device.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.status === 'ONLINE' ? 'Online' :
                         device.status === 'ERROR'  ? 'Erro'   : 'Offline'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Day Summary */}
          <Card>
            <CardHeader className="px-5 py-4 border-b border-border">
              <CardTitle>Resumo do Dia</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-3">
              {[
                { label: 'Total de eventos', value: data.recentEvents.length },
                { label: 'Entradas',         value: data.recentEvents.filter((e: any) => e.eventType === 'ENTRY').length },
                { label: 'Saídas',           value: data.recentEvents.filter((e: any) => e.eventType === 'EXIT').length  },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <ManualCheckinWizard open={manualOpen} onOpenChange={setManualOpen} />
    </div>
    </div>
    </>
  );
}
