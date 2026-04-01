'use client';

import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  User, Mail, Phone, Bell, BellOff, LogOut, Shield,
  ChevronRight, Moon, Sun, Smartphone, Info,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { toast } from '@/components/ui/toaster';
import { getInitials } from '@/lib/utils';

export default function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notifyEntry, setNotifyEntry] = useState(true);
  const [notifyExit, setNotifyExit] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '' });

  useEffect(() => {
    setForm({ name: user?.name || '', phone: '' });
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted');
  }, [user]);

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
      }
    } finally {
      setLoading(false);
    }
  }

  const sections = [
    {
      title: 'Notificações',
      items: [
        {
          icon: Bell,
          label: 'Push Notifications',
          description: pushEnabled ? 'Ativadas' : 'Desativadas',
          right: <Switch checked={pushEnabled} onCheckedChange={() => {}} />,
        },
        {
          icon: LogOut,
          label: 'Alerta de Entrada',
          right: <Switch checked={notifyEntry} onCheckedChange={setNotifyEntry} />,
        },
        {
          icon: LogOut,
          label: 'Alerta de Saída',
          right: <Switch checked={notifyExit} onCheckedChange={setNotifyExit} />,
        },
      ],
    },
    {
      title: 'Privacidade & Segurança',
      items: [
        {
          icon: Shield,
          label: 'Política de Privacidade',
          right: <ChevronRight className="h-4 w-4 text-muted-foreground" />,
        },
        {
          icon: Info,
          label: 'Termos de Uso',
          right: <ChevronRight className="h-4 w-4 text-muted-foreground" />,
        },
        {
          icon: Shield,
          label: 'Dados LGPD',
          description: 'Solicitação de exclusão de dados',
          right: <ChevronRight className="h-4 w-4 text-muted-foreground" />,
        },
      ],
    },
    {
      title: 'Sobre',
      items: [
        {
          icon: Smartphone,
          label: 'Versão do App',
          description: 'Safe Door Brasil v0.1.0 MVP',
          right: null,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">Perfil</h1>
        <ThemeToggle />
      </header>

      <div className="flex-1 px-5 pb-6 space-y-6">
        {/* Profile Card */}
        <div className="rounded-lg border border-border/50 bg-card  p-5">
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
                    <Label className="text-xs">Telefone</Label>
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

        {/* Settings Sections */}
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {section.title}
            </h3>
            <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
              {section.items.map((item, i) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i < section.items.length - 1 ? 'border-b border-border/40' : ''
                  }`}
                >
                  <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                  {item.right}
                </div>
              ))}
            </div>
          </div>
        ))}

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
