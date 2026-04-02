'use client';

import { useState } from 'react';
import {
  Plus, Wifi, WifiOff, AlertTriangle, Copy, Eye, EyeOff,
  Tablet, Camera, MoreHorizontal, Edit, Trash2, RefreshCw, Check,
  Activity, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { cn, formatRelativeTime, generateApiKey } from '@/lib/utils';

type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';
type DeviceType = 'TABLET' | 'CAMERA_AGENT';

interface DeviceItem {
  id: string;
  name: string;
  description: string | null;
  type: DeviceType;
  status: DeviceStatus;
  apiKey: string;
  lastSeen: Date | string | null;
  lastIpAddress: string | null;
  firmwareVersion: string | null;
  _count: { attendanceEvents: number };
}

interface DevicesClientProps {
  devices: DeviceItem[];
  schoolId: string;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  type: 'TABLET' as DeviceType,
};

const statusConfig: Record<DeviceStatus, {
  label: string;
  variant: 'online' | 'offline' | 'destructive';
  icon: React.ReactNode;
  pulse: string;
  dot: string;
}> = {
  ONLINE: {
    label: 'Online',
    variant: 'online',
    icon: <Wifi className="h-4 w-4" />,
    pulse: 'animate-pulse bg-success',
    dot: 'bg-success',
  },
  OFFLINE: {
    label: 'Offline',
    variant: 'offline',
    icon: <WifiOff className="h-4 w-4" />,
    pulse: '',
    dot: 'bg-gray-500',
  },
  ERROR: {
    label: 'Erro',
    variant: 'destructive',
    icon: <AlertTriangle className="h-4 w-4" />,
    pulse: 'animate-pulse bg-danger',
    dot: 'bg-danger',
  },
};

const typeConfig: Record<DeviceType, { label: string; icon: React.ReactNode }> = {
  TABLET: { label: 'Tablet', icon: <Tablet className="h-4 w-4" /> },
  CAMERA_AGENT: { label: 'Câmera', icon: <Camera className="h-4 w-4" /> },
};

function ApiKeyDisplay({ apiKey }: { apiKey: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast({ variant: 'success', title: 'API Key copiada', description: 'Chave copiada para área de transferência.' });
    setTimeout(() => setCopied(false), 2000);
  }

  const masked = apiKey.slice(0, 8) + '••••••••••••••••••••••••' + apiKey.slice(-4);

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <code className="flex-1 text-xs font-mono bg-secondary/80 rounded-lg px-2.5 py-1.5 text-muted-foreground truncate">
        {visible ? apiKey : masked}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setVisible((v) => !v)}
        title={visible ? 'Ocultar chave' : 'Mostrar chave'}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        title="Copiar chave"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function DevicesClient({ devices: initialDevices, schoolId }: DevicesClientProps) {
  const [devices, setDevices] = useState<DeviceItem[]>(initialDevices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const online = devices.filter((d) => d.status === 'ONLINE').length;
  const offline = devices.filter((d) => d.status === 'OFFLINE').length;
  const error = devices.filter((d) => d.status === 'ERROR').length;

  function openCreate() {
    setEditingDevice(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(device: DeviceItem) {
    setEditingDevice(device);
    setForm({
      name: device.name,
      description: device.description ?? '',
      type: device.type,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingDevice(null);
    setForm(EMPTY_FORM);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDevices(data.devices ?? data);
      toast({ variant: 'success', title: 'Dispositivos atualizados' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao atualizar' });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: 'warning', title: 'Nome obrigatório' });
      return;
    }
    setLoading(true);
    try {
      if (editingDevice) {
        const res = await fetch(`/api/devices/${editingDevice.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
            type: form.type,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const patchPayload = await res.json();
        const updated: DeviceItem = patchPayload.device ?? patchPayload;
        setDevices((prev) =>
          prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
        );
        toast({ variant: 'success', title: 'Dispositivo atualizado', description: updated.name });
      } else {
        const res = await fetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
            type: form.type,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const payload = await res.json();
        const created: DeviceItem = payload.device ?? payload;
        setDevices((prev) => [{ ...created, _count: { attendanceEvents: 0 } }, ...prev]);
        toast({ variant: 'success', title: 'Dispositivo registrado', description: created.name });
      }
      closeDialog();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(device: DeviceItem) {
    if (!confirm(`Remover dispositivo "${device.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`/api/devices/${device.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      toast({ variant: 'success', title: 'Dispositivo removido', description: device.name });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: err.message });
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-muted-foreground">Online</p>
            <div className="flex items-center gap-1">
              {online > 0 && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
              <Wifi className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{online}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-muted-foreground">Offline</p>
            <WifiOff className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
          <p className="text-2xl font-semibold tabular-nums">{offline}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-muted-foreground">Com erro</p>
            <div className="flex items-center gap-1">
              {error > 0 && <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />}
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{error}</p>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {devices.length} dispositivo{devices.length !== 1 ? 's' : ''} registrado{devices.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Atualizar
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Registrar dispositivo
          </Button>
        </div>
      </div>

      {/* Device Cards Grid */}
      {devices.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center">
            <Tablet className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">Nenhum dispositivo registrado</p>
          <p className="text-sm text-muted-foreground">
            Registre um tablet ou câmera para começar a controlar o acesso.
          </p>
          <Button onClick={openCreate} className="mt-2">
            <Plus className="h-4 w-4" />
            Registrar dispositivo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {devices.map((device) => {
            const sc = statusConfig[device.status];
            const tc = typeConfig[device.type];
            return (
              <Card
                key={device.id}
                className={cn(
                  'group relative overflow-hidden transition-all duration-200',
                  device.status === 'ONLINE' && 'hover:border-success/40',
                  device.status === 'ERROR' && 'border-destructive/30 hover:border-destructive/50',
                  device.status === 'OFFLINE' && 'hover:border-border'
                )}
              >
                {/* Status bar at top */}
                <div
                  className={cn(
                    'absolute inset-x-0 top-0 h-0.5',
                    device.status === 'ONLINE' && 'bg-success/70',
                    device.status === 'ERROR' && 'bg-danger/70',
                    device.status === 'OFFLINE' && 'bg-border/50'
                  )}
                />

                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between">
                    {/* Device icon + status pulse */}
                    <div className="relative">
                      <div
                        className={cn(
                          'h-12 w-12 rounded-lg flex items-center justify-center',
                          device.status === 'ONLINE' && 'bg-success/10',
                          device.status === 'ERROR' && 'bg-destructive/10',
                          device.status === 'OFFLINE' && 'bg-secondary'
                        )}
                      >
                        {device.type === 'TABLET'
                          ? <Tablet className={cn('h-6 w-6', device.status === 'ONLINE' ? 'text-success' : device.status === 'ERROR' ? 'text-destructive' : 'text-muted-foreground')} />
                          : <Camera className={cn('h-6 w-6', device.status === 'ONLINE' ? 'text-success' : device.status === 'ERROR' ? 'text-destructive' : 'text-muted-foreground')} />
                        }
                      </div>
                      {/* Pulse indicator */}
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card',
                          sc.dot,
                          device.status !== 'OFFLINE' && 'animate-pulse'
                        )}
                      />
                    </div>

                    {/* Actions menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(device)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(device)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  <div>
                    <CardTitle className="text-base leading-snug">{device.name}</CardTitle>
                    {device.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {device.description}
                      </p>
                    )}
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={sc.variant} className="text-xs gap-1">
                      {sc.icon}
                      {sc.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1">
                      {tc.icon}
                      {tc.label}
                    </Badge>
                  </div>

                  {/* Last seen */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {device.lastSeen
                        ? `Visto ${formatRelativeTime(device.lastSeen)}`
                        : 'Nunca conectado'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />
                      {device._count.attendanceEvents} eventos
                    </span>
                  </div>

                  {/* IP */}
                  {device.lastIpAddress && (
                    <p className="text-xs text-muted-foreground font-mono">
                      IP: {device.lastIpAddress}
                    </p>
                  )}

                  {/* API Key */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">API Key</p>
                    <ApiKeyDisplay apiKey={device.apiKey} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDevice ? 'Editar Dispositivo' : 'Registrar Dispositivo'}</DialogTitle>
            <DialogDescription>
              {editingDevice
                ? 'Atualize as informações do dispositivo.'
                : 'Preencha os dados do novo dispositivo. Uma API Key será gerada automaticamente.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="device-name">Nome do dispositivo *</Label>
              <Input
                id="device-name"
                placeholder="Ex: Tablet Entrada Principal"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="device-desc">Descrição</Label>
              <Input
                id="device-desc"
                placeholder="Ex: Localizado na recepção"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="device-type">Tipo</Label>
              <select
                id="device-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DeviceType }))}
                className="w-full h-11 rounded-md border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              >
                <option value="TABLET">Tablet</option>
                <option value="CAMERA_AGENT">Câmera / Agente</option>
              </select>
            </div>

            {!editingDevice && (
              <div className="rounded-md bg-secondary border border-border p-3">
                <p className="text-xs text-foreground font-medium">
                  Uma API Key única será gerada automaticamente ao registrar o dispositivo.
                  Guarde-a em local seguro — ela é usada para autenticar o agente.
                </p>
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {editingDevice ? 'Salvar alterações' : 'Registrar dispositivo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
