'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';

// Inner component that uses useSearchParams — must be wrapped in <Suspense>
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const callbackUrl = searchParams.get('callbackUrl') || '/';

  function validate() {
    const e: Record<string, string> = {};
    if (!form.email) e.email = 'E-mail é obrigatório';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'E-mail inválido';
    if (!form.password) e.password = 'Senha é obrigatória';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});

    const result = await signIn('credentials', {
      email: form.email.toLowerCase(),
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setErrors({ general: 'E-mail ou senha incorretos.' });
      toast({ variant: 'destructive', title: 'Erro ao entrar', description: 'Verifique suas credenciais.' });
    } else {
      toast({ variant: 'success', title: 'Bem-vindo de volta!', description: 'Redirecionando...' });
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
        <p className="text-sm text-muted-foreground">
          Acesse o painel com suas credenciais
        </p>
      </div>

      {/* Error Banner */}
      {errors.general && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive animate-fade-in">
          {errors.general}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            autoFocus
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
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

        <Button type="submit" loading={loading} className="w-full">
          Entrar
        </Button>
      </form>

      {/* Demo Credentials */}
      <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Credenciais de demonstração
        </p>
        <div className="space-y-1">
          {[
            { label: 'Admin',       email: 'admin@escolademo.edu.br', password: 'admin123'  },
            { label: 'Responsável', email: 'mae@demo.com',             password: 'parent123' },
          ].map((cred) => (
            <button
              key={cred.email}
              type="button"
              onClick={() => setForm({ email: cred.email, password: cred.password })}
              className="w-full text-left px-2.5 py-2 rounded-md hover:bg-accent transition-colors"
            >
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {cred.label}
              </span>
              <div className="text-xs text-foreground/70 mt-0.5">{cred.email}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        Novo responsável?{' '}
        <Link href="/auth/register" className="text-foreground font-medium hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="space-y-6 animate-pulse"><div className="h-8 bg-muted rounded w-1/3" /><div className="h-10 bg-muted rounded" /><div className="h-10 bg-muted rounded" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
