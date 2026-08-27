'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';

/** Grupo de opções únicas, no estilo cartão da identidade visual. */
function Choice({
  label, options, value, onChange,
}: {
  label: string;
  options: { v: string; t: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${
              value === o.v
                ? 'border-foreground bg-accent font-medium'
                : 'border-border hover:bg-accent/50 text-muted-foreground'
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

const SIZE = [
  { v: 'ATE_100', t: 'Até 100 alunos' },
  { v: '101_300', t: '101 a 300' },
  { v: '301_600', t: '301 a 600' },
  { v: '600_MAIS', t: 'Mais de 600' },
];
const REVENUE = [
  { v: 'ATE_50K', t: 'Até R$ 50 mil/mês' },
  { v: '50_150K', t: 'R$ 50 a 150 mil' },
  { v: '150_500K', t: 'R$ 150 a 500 mil' },
  { v: '500K_MAIS', t: 'Acima de R$ 500 mil' },
];
const YEARS = [
  { v: 'MENOS_1', t: 'Menos de 1 ano' },
  { v: '1_3', t: '1 a 3 anos' },
  { v: '3_10', t: '3 a 10 anos' },
  { v: '10_MAIS', t: 'Mais de 10 anos' },
];
const RECOG = [
  { v: 'NAO', t: 'Não uso nada' },
  { v: 'PLANILHA', t: 'Planilha ou caderno' },
  { v: 'CATRACA', t: 'Catraca ou cartão' },
  { v: 'OUTRO_APP', t: 'Outro aplicativo' },
  { v: 'SIM_FACIAL', t: 'Já uso facial' },
];

export function RegisterSchoolForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    schoolName: '', ownerName: '', ownerPhone: '', email: '', password: '',
    city: '', state: '',
    sizeStudents: '', revenueBand: '', yearsInMarket: '', usesRecognition: '',
    lgpdAccepted: false, website: '',
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const step1Valid = form.schoolName && form.ownerName && form.email && form.password.length >= 8;

  async function submit() {
    if (!form.lgpdAccepted) {
      toast({ variant: 'warning', title: 'Aceite os termos para continuar.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Não foi possível criar a conta', description: data.error });
        return;
      }
      // Entra automaticamente e cai no onboarding.
      const signInRes = await signIn('credentials', {
        email: form.email.toLowerCase(), password: form.password, redirect: false,
      });
      if (signInRes?.error) {
        toast({ variant: 'success', title: 'Conta criada!', description: 'Entre com seu e-mail e senha.' });
        router.push('/auth/login');
        return;
      }
      router.push('/admin/onboarding');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Criar conta da escola</h2>
        <p className="text-sm text-muted-foreground">
          {step === 1 ? 'Comece com os dados de acesso.' : 'Conte um pouco sobre a escola. Leva menos de um minuto.'}
        </p>
      </div>

      {/* Passos */}
      <div className="flex items-center gap-2">
        {[1, 2].map((n) => (
          <div key={n} className={`h-1 flex-1 rounded-full ${step >= n ? 'bg-foreground' : 'bg-border'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* Honeypot anti-bot: invisível e fora da navegação; humano não vê. */}
          <input
            type="text" name="website" tabIndex={-1} autoComplete="off"
            aria-hidden="true"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />
          <div className="space-y-1.5">
            <Label htmlFor="schoolName">Nome da escola</Label>
            <Input id="schoolName" value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} placeholder="Ex.: Colégio Novo Horizonte" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ownerName">Seu nome</Label>
              <Input id="ownerName" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Proprietário(a)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerPhone">Telefone</Label>
              <Input id="ownerPhone" value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="voce@escola.com.br" autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Ao menos 8 caracteres" autoComplete="new-password" />
          </div>
          <Button className="w-full" disabled={!step1Valid} onClick={() => setStep(2)}>
            Continuar
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="UF" maxLength={2} />
            </div>
          </div>
          <Choice label="Tamanho da escola" options={SIZE} value={form.sizeStudents} onChange={(v) => set('sizeStudents', v)} />
          <Choice label="Faturamento mensal aproximado" options={REVENUE} value={form.revenueBand} onChange={(v) => set('revenueBand', v)} />
          <Choice label="Tempo de mercado" options={YEARS} value={form.yearsInMarket} onChange={(v) => set('yearsInMarket', v)} />
          <Choice label="Já usa algum controle de acesso?" options={RECOG} value={form.usesRecognition} onChange={(v) => set('usesRecognition', v)} />

          <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={form.lgpdAccepted} onChange={(e) => set('lgpdAccepted', e.target.checked)} className="h-4 w-4 mt-0.5 rounded border-border accent-foreground" />
            <span className="text-muted-foreground">
              Li e aceito os <Link href="/terms" className="text-foreground hover:underline">termos de uso</Link> e a{' '}
              <Link href="/privacy" className="text-foreground hover:underline">política de privacidade</Link>.
            </span>
          </label>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button className="flex-1" loading={loading} onClick={submit}>
              <Check className="h-4 w-4 mr-1.5" /> Criar conta e começar
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/auth/login" className="text-foreground font-medium hover:underline">Entrar</Link>
      </p>
    </div>
  );
}
