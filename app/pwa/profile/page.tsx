'use client';

import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  User, Mail, Phone, Bell, BellOff, LogOut, Shield,
  ChevronRight, Smartphone, Info, Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { toast } from '@/components/ui/toaster';
import { getInitials } from '@/lib/utils';

// Convert VAPID public key (base64url) → Uint8Array for pushManager.subscribe()
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [notifyEntry, setNotifyEntry] = useState(true);
  const [notifyExit, setNotifyExit] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });

  // ── Detect push support & current state ────────────────────────────
  useEffect(() => {
    setForm({ name: user?.name || '', phone: '' });

    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setPushSupported(supported);

    if (supported) {
      // Check if already subscribed
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushEnabled(!!sub))
        .catch(() => {});
    }
  }, [user]);

  // ── Save profile ────────────────────────────────────────────────────
  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch('/api/parent/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({ variant: 'success', title: 'Perfil atualizado!' });
        setEditing(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao salvar.' });
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Toggle push notifications ───────────────────────────────────────
  async function handlePushToggle(enable: boolean) {
    if (pushLoading) return;
    setPushLoading(true);

    try {
      if (enable) {
        // 1. Request browser permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast({
            variant: 'warning',
            title: 'Permissão negada',
            description: 'Habilite notificações nas configurações do navegador.',
          });
          return;
        }

        // 2. Wait for service worker (disabled in dev by next-pwa config)
        let registration: ServiceWorkerRegistration;
        try {
          registration = await navigator.serviceWorker.ready;
        } catch {
          toast({
            variant: 'warning',
            title: 'Service worker não disponível',
            description: 'Notificações push só funcionam em produção ou com HTTPS.',
          });
          return;
        }

        // 3. Subscribe with VAPID public key
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          toast({
            variant: 'warning',
            title: 'Chave VAPID não configurada',
            description: 'Configure NEXT_PUBLIC_VAPID_PUBLIC_KEY no servidor.',
          });
          return;
        }

        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const subJSON = sub.toJSON() as any;

        // 4. Save to server
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subJSON.endpoint,
            keys: subJSON.keys,
          }),
        });

        if (res.ok) {
          setPushEnabled(true);
          toast({ variant: 'success', title: 'Notificações ativadas!', description: 'Você receberá alertas de entrada e saída.' });
        } else {
          await sub.unsubscribe();
          toast({ variant: 'destructive', title: 'Erro ao salvar subscrição.' });
        }

      } else {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();

        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }

        setPushEnabled(false);
        toast({ variant: 'success', title: 'Notificações desativadas.' });
      }
    } catch (err: any) {
      console.error('Push toggle error:', err);
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Falha ao configurar notificações.' });
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">Perfil</h1>
        <ThemeToggle />
      </header>

      <div className="flex-1 px-5 pb-6 space-y-6">
        {/* Profile Card */}
        <div className="rounded-lg border border-border/50 bg-card p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.image || ''} />
              <AvatarFallback className="text-xl font-bold">
                {getInitials(user?.name || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone (WhatsApp)</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} loading={loading} className="flex-1">
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="flex-1">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold leading-tight">{user?.name}</h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(true)}
                    className="mt-2 h-7 text-foreground hover:bg-secondary -ml-2 text-xs"
                  >
                    Editar perfil
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Notificações
          </h3>
          <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
            {/* Push toggle */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                {pushEnabled ? (
                  <Bell className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {!pushSupported
                    ? 'Não suportado neste navegador'
                    : pushEnabled
                    ? 'Ativadas'
                    : 'Desativadas'}
                </p>
              </div>
              {pushLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={pushEnabled}
                  disabled={!pushSupported || pushLoading}
                  onCheckedChange={handlePushToggle}
                />
              )}
            </div>

            {/* Entry alerts */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                <LogOut className="h-4 w-4 text-muted-foreground rotate-180" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Alerta de Entrada</p>
              </div>
              <Switch
                checked={notifyEntry}
                disabled={!pushEnabled}
                onCheckedChange={setNotifyEntry}
              />
            </div>

            {/* Exit alerts */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Alerta de Saída</p>
              </div>
              <Switch
                checked={notifyExit}
                disabled={!pushEnabled}
                onCheckedChange={setNotifyExit}
              />
            </div>
          </div>

          {pushSupported && !pushEnabled && (
            <p className="text-xs text-muted-foreground mt-2 px-1">
              Ative as notificações para receber alertas em tempo real quando seu filho entrar ou sair da escola.
            </p>
          )}
        </div>

        {/* Privacy & Security */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Privacidade & Segurança
          </h3>
          <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Política de Privacidade</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Termos de Uso</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Dados LGPD</p>
                <p className="text-xs text-muted-foreground mt-0.5">Solicitação de exclusão de dados</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* About */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Sobre
          </h3>
          <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Versão do App</p>
                <p className="text-xs text-muted-foreground mt-0.5">Safe Door Brasil v1.0.0 MVP</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <Button
          variant="outline"
          className="w-full h-12 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 gap-2"
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
