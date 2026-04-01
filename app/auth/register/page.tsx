'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Nome é obrigatório';
    if (!form.email) e.email = 'E-mail é obrigatório';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'E-mail inválido';
    if (!form.password) e.password = 'Senha é obrigatória';
    else if (form.password.length < 8) e.password = 'Mínimo 8 caracteres';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Senhas não conferem';
    if (!lgpdAccepted) e.lgpd = 'Aceite os termos para continuar';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email.toLowerCase(),
          phone: form.phone, password: form.password, lgpdAccepted,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors({ general: data.error || 'Erro ao criar conta.' });
        toast({ variant: 'destructive', title: 'Erro', description: data.error });
      } else {
        toast({ variant: 'success', title: 'Conta criada!', description: 'Faça login para continuar.' });
        router.push('/auth/login?registered=true');
      }
    } catch {
      setErrors({ general: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Criar conta</h2>
        <p className="text-sm text-muted-foreground">
          Cadastro para responsáveis
        </p>
      </div>

      {errors.general && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name" type="text" placeholder="Maria da Silva"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name" autoFocus
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email" type="email" placeholder="seu@email.com"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">
            Telefone{' '}
            <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="phone" type="tel" placeholder="(11) 99999-9999"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            autoComplete="tel"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input
            id="confirmPassword" type="password" placeholder="Repita a senha"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
        </div>

        {/* LGPD Consent */}
        <div className="rounded-md border border-border bg-secondary/30 p-3">
          <button
            type="button"
            onClick={() => setLgpdAccepted(!lgpdAccepted)}
            className="flex items-start gap-2.5 text-left w-full"
          >
            {lgpdAccepted
              ? <CheckSquare className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
              : <Square className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            }
            <p className="text-xs text-muted-foreground leading-relaxed">
              Concordo com os{' '}
              <Link href="/terms" className="text-foreground underline-offset-2 hover:underline">Termos de Uso</Link>
              {' '}e a{' '}
              <Link href="/privacy" className="text-foreground underline-offset-2 hover:underline">Política de Privacidade</Link>,
              incluindo o uso de reconhecimento facial e dados biométricos conforme a LGPD.
            </p>
          </button>
          {errors.lgpd && <p className="text-xs text-destructive mt-2">{errors.lgpd}</p>}
        </div>

        <Button
          type="submit"
          loading={loading}
          className="w-full"
          disabled={!lgpdAccepted}
        >
          Criar conta
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link href="/auth/login" className="text-foreground font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
