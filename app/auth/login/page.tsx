'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
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

  // Só caminhos relativos: callbackUrl vindo da URL é input de estranho —
  // sem o filtro, /auth/login?callbackUrl=https://site-falso.com virava um
  // open redirect pós-autenticação.
  const rawCallback = searchParams.get('callbackUrl') || '/';
  const callbackUrl = /^\/(?!\/)/.test(rawCallback) ? rawCallback : '/';
  const loginError = searchParams.get('error');

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
      // Fetch session to determine role-based redirect
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();
      const role = session?.user?.role;
      const dest = callbackUrl !== '/'
        ? callbackUrl
        : role === 'SUPERADMIN'
          ? '/odono'
          : role === 'ADMIN'
            ? '/admin/dashboard'
            : '/pwa/children';
      router.push(dest);
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

      {/* Aviso vindo do redirect (ex.: escola suspensa) — antes o admin
          logava, era devolvido para cá e ficava num loop sem explicação. */}
      {loginError === 'school_suspended' && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground animate-fade-in">
          O acesso da sua escola está suspenso. Fale com o suporte do Porta Segura para regularizar.
        </div>
      )}

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
            {/* Não há fluxo de redefinição por e-mail ainda; o link antigo
                apontava para uma página inexistente (404). A redefinição é
                feita pela secretaria (admin) ou pelo superadmin. */}
            <span className="text-xs text-muted-foreground" title="Peça à secretaria da escola para redefinir sua senha.">
              Esqueceu? Fale com a escola
            </span>
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

      {/* As credenciais de demonstração saíram daqui de propósito: elas
          incluíam um login de ADMIN funcional exposto ao mundo, numa conta
          que carrega dados reais. Quem demonstra o produto sabe as senhas. */}

      {/* O caminho de conta do responsável é o LINK DA TURMA: criar conta
          solta aqui gerava um usuário órfão (sem escola, sem filhos) que não
          conseguia fazer nada — puro suporte. */}
      <p className="text-center text-xs text-muted-foreground">
        Responsável sem acesso? Peça o link da turma na secretaria da escola —
        a conta é criada por ele.
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
