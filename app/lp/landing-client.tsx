'use client';

import { useState } from 'react';
import {
  Shield, ScanFace, Bell, Clock, BarChart3, Users, CheckCircle2,
  ChevronDown, ChevronRight, ArrowRight, Play, Smartphone,
  Lock, Zap, Eye, GraduationCap, Star, Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ================================================================
   SAFE DOOR — LANDING PAGE DE ALTA CONVERSÃO
   Estrutura VSL + Prova Social + Benefícios + Preço + FAQ + CTA
   ================================================================ */

const WHATSAPP_NUMBER = '5500000000000'; // TODO: trocar para o número real
const WHATSAPP_MSG = encodeURIComponent(
  'Olá! Vi a página do Safe Door e quero saber mais sobre o sistema de reconhecimento facial para minha escola.'
);
const CTA_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;

// ── Social Proof Numbers ──
const STATS = [
  { value: '99,7%', label: 'Precisão facial' },
  { value: '<2s', label: 'Tempo de registro' },
  { value: '24/7', label: 'Monitoramento' },
  { value: '100%', label: 'Conforme LGPD' },
];

// ── Pain Points ──
const PAINS = [
  {
    icon: Clock,
    title: 'Chamada manual consome 15 min por turma',
    desc: 'Professores perdem tempo que deveria ser dedicado ao ensino.',
  },
  {
    icon: Shield,
    title: 'Pais não sabem se o filho chegou',
    desc: 'A ansiedade dos pais só é resolvida quando a criança volta para casa.',
  },
  {
    icon: Eye,
    title: 'Sem controle de quem entra e sai',
    desc: 'A portaria não consegue identificar cada aluno entre centenas.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios de frequência atrasados',
    desc: 'Dados de presença demoram dias para serem compilados manualmente.',
  },
];

// ── How it works steps ──
const STEPS = [
  {
    num: '01',
    title: 'Cadastre os alunos',
    desc: 'Upload de fotos pelo painel ou tire direto pelo celular. Sem equipamento especial.',
    icon: Users,
  },
  {
    num: '02',
    title: 'Aluno passa pela câmera',
    desc: 'Um tablet na portaria identifica o rosto em menos de 2 segundos com 99,7% de precisão.',
    icon: ScanFace,
  },
  {
    num: '03',
    title: 'Pais recebem na hora',
    desc: 'Notificação instantânea no celular: "Seu filho chegou à escola às 07:12".',
    icon: Bell,
  },
];

// ── Features ──
const FEATURES = [
  {
    icon: ScanFace,
    title: 'Reconhecimento Facial por IA',
    desc: 'Tecnologia AWS com 99,7% de precisão. Funciona mesmo com máscara, óculos ou boné.',
  },
  {
    icon: Bell,
    title: 'Notificações em Tempo Real',
    desc: 'Os pais recebem alerta instantâneo de entrada e saída direto no celular.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Completo',
    desc: 'Frequência, atrasos, saídas antecipadas e relatórios exportáveis com um clique.',
  },
  {
    icon: Clock,
    title: 'Controle Automático de Atrasos',
    desc: 'O sistema identifica atrasos e saídas antecipadas com base no horário da escola.',
  },
  {
    icon: Smartphone,
    title: 'App para Pais (PWA)',
    desc: 'Os pais acompanham tudo pelo celular. Sem precisar baixar nada na loja.',
  },
  {
    icon: Users,
    title: 'Turnos Personalizáveis',
    desc: 'Manhã, tarde, noite e integral. Cada turma com seu horário configurável.',
  },
  {
    icon: GraduationCap,
    title: 'Grade Horária Inteligente',
    desc: 'Monte a grade de matérias, copie entre turmas e organize tudo visualmente.',
  },
  {
    icon: Lock,
    title: '100% Conforme com a LGPD',
    desc: 'Dados criptografados, armazenados no Brasil, com consentimento dos responsáveis.',
  },
];

// ── Pricing ──
const PLANS = [
  {
    name: 'Essencial',
    students: 'Até 100 alunos',
    price: '297',
    annual: '2.997',
    annualMonthly: '249',
    popular: false,
    features: [
      'Reconhecimento facial ilimitado',
      'Notificações para pais',
      'Dashboard de frequência',
      'Relatórios básicos',
      'App PWA para pais',
      'Suporte por e-mail',
    ],
  },
  {
    name: 'Profissional',
    students: 'Até 300 alunos',
    price: '497',
    annual: '4.997',
    annualMonthly: '416',
    popular: true,
    features: [
      'Tudo do Essencial +',
      'Controle de turnos',
      'Grade horária completa',
      'Relatórios avançados',
      'Alerta de alunos sem responsável',
      'Suporte prioritário via WhatsApp',
    ],
  },
  {
    name: 'Premium',
    students: 'Até 600 alunos',
    price: '797',
    annual: '7.997',
    annualMonthly: '666',
    popular: false,
    features: [
      'Tudo do Profissional +',
      'Múltiplos pontos de acesso',
      'API para integração',
      'Relatórios personalizados',
      'Onboarding dedicado',
      'Gerente de conta exclusivo',
    ],
  },
];

// ── FAQ ──
const FAQS = [
  {
    q: 'Preciso comprar câmera especial ou catraca?',
    a: 'Não. Um tablet ou celular com câmera frontal na portaria já é suficiente. Sem investimento em hardware.',
  },
  {
    q: 'Quanto tempo demora para implantar?',
    a: 'Em 24 horas o sistema está funcionando. Basta cadastrar os alunos com fotos pelo próprio celular.',
  },
  {
    q: 'E se a internet cair?',
    a: 'O registro manual está disponível como backup. Quando a internet voltar, tudo sincroniza automaticamente.',
  },
  {
    q: 'É seguro? E a LGPD?',
    a: 'Sim. Todos os dados são criptografados com AES-256, armazenados em servidores no Brasil, e o sistema está 100% em conformidade com a LGPD. Os pais precisam consentir o cadastro.',
  },
  {
    q: 'Os pais precisam instalar um aplicativo?',
    a: 'Não. O app funciona direto pelo navegador do celular (PWA). Sem download, sem ocupar espaço no celular.',
  },
  {
    q: 'Funciona com alunos usando máscara ou óculos?',
    a: 'Sim. A tecnologia AWS Rekognition identifica o rosto mesmo com acessórios, com 99,7% de precisão.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Não há multa de cancelamento. Acreditamos que você vai ficar porque o produto entrega valor real.',
  },
  {
    q: 'Minha escola tem período integral, funciona?',
    a: 'Sim. O sistema suporta turnos manhã, tarde, noite e integral, com horários totalmente personalizáveis por turma.',
  },
];

// ── Objections Crusher ──
const OBJECTIONS = [
  { obj: '"É caro"', answer: 'Custa menos que R$ 3 por aluno/mês. Menos que uma folha de chamada impressa.' },
  { obj: '"Não preciso disso"', answer: 'Até acontecer um incidente. Prevenção custa 100x menos que remediação.' },
  { obj: '"É complicado de usar"', answer: 'Se você sabe tirar uma selfie, sabe usar o Safe Door. Setup em 24h.' },
  { obj: '"E se não funcionar?"', answer: '7 dias de teste grátis. Se não gostar, não paga nada.' },
];

function CTAButton({ className, children, size = 'lg' }: { className?: string; children: React.ReactNode; size?: 'lg' | 'md' }) {
  return (
    <a
      href={CTA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-300',
        'bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] active:scale-[0.97]',
        size === 'lg' ? 'px-8 py-4 text-lg' : 'px-6 py-3 text-base',
        className
      )}
    >
      {children}
    </a>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
      >
        <span className="text-[15px] font-medium text-white">{q}</span>
        <ChevronDown className={cn('h-4 w-4 text-zinc-400 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div className={cn('overflow-hidden transition-all duration-300', open ? 'max-h-40 pb-4' : 'max-h-0')}>
        <p className="text-sm text-zinc-400 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export function LandingPageClient() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ═══════════════════════ NAV ═══════════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px) saturate(180%)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-lg tracking-tight">Safe Door</span>
          </div>
          <a
            href={CTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition-all"
          >
            Falar com especialista
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </nav>

      {/* ═══════════════════════ HERO + VSL ═══════════════════════ */}
      <section className="relative pt-28 pb-16 px-5">
        {/* Gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-emerald-500/8 blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400 tracking-wide uppercase">
              Tecnologia de ponta para escolas
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[2.5rem] sm:text-5xl md:text-6xl font-extrabold leading-[1.08] tracking-tight mb-5">
            Sua escola sabe{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              exatamente
            </span>{' '}
            quem entrou e quem saiu?
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            Reconhecimento facial que registra a presença dos alunos em{' '}
            <strong className="text-white">menos de 2 segundos</strong> e notifica os pais{' '}
            <strong className="text-white">instantaneamente</strong>.
            Sem catracas. Sem crachás. Sem chamada manual.
          </p>

          {/* VSL Placeholder */}
          <div className="relative max-w-3xl mx-auto mb-4 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(16,185,129,0.08)]">
            <div className="aspect-video bg-zinc-900 flex items-center justify-center">
              {/* TODO: Replace with actual video embed */}
              <button className="group flex flex-col items-center gap-3">
                <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:border-emerald-400/50 transition-all duration-300 group-hover:scale-110">
                  <Play className="h-8 w-8 text-emerald-400 ml-1" fill="currentColor" />
                </div>
                <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  Assista a demonstração (2 min)
                </span>
              </button>
            </div>
          </div>

          {/* Mini caption */}
          <p className="text-xs text-zinc-600 mb-8">
            Veja como funciona na prática — sem compromisso
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <CTAButton>
              Quero testar 7 dias grátis
              <ArrowRight className="h-5 w-5" />
            </CTAButton>
            <p className="text-xs text-zinc-600">
              Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ SOCIAL PROOF BAR ═══════════════════════ */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={s.label} className={cn('flex flex-col items-center py-8 px-4', i < 3 && 'md:border-r border-white/5')}>
              <span className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">{s.value}</span>
              <span className="text-xs text-zinc-500 mt-1">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ PAIN POINTS ═══════════════════════ */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest text-red-400/80 uppercase mb-3">O problema</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Sua escola ainda depende de{' '}
              <span className="text-red-400">chamada manual?</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {PAINS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all duration-300">
                <p.icon className="h-5 w-5 text-red-400/60 mb-3" />
                <h3 className="text-[15px] font-semibold mb-1">{p.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ HOW IT WORKS ═══════════════════════ */}
      <section className="py-20 px-5 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest text-emerald-400/80 uppercase mb-3">Simples assim</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Funcionando em <span className="text-emerald-400">24 horas</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative">
                {i < 2 && (
                  <ChevronRight className="hidden md:block absolute -right-5 top-12 h-5 w-5 text-zinc-700" />
                )}
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center h-full">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                    <s.icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <span className="block text-[10px] font-bold text-emerald-500/40 tracking-widest uppercase mb-2">Passo {s.num}</span>
                  <h3 className="text-base font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURES ═══════════════════════ */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest text-emerald-400/80 uppercase mb-3">Tudo que você precisa</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Uma plataforma <span className="text-emerald-400">completa</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] transition-all duration-300 group">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-colors">
                  <f.icon className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <h3 className="text-[14px] font-semibold mb-1">{f.title}</h3>
                <p className="text-[13px] text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ OBJECTIONS CRUSHER ═══════════════════════ */}
      <section className="py-20 px-5 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Talvez você esteja pensando...
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {OBJECTIONS.map((o) => (
              <div key={o.obj} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                <p className="text-sm font-semibold text-zinc-400 mb-2">{o.obj}</p>
                <p className="text-[14px] text-white leading-relaxed">{o.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PRICING ═══════════════════════ */}
      <section className="py-20 px-5" id="precos">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest text-emerald-400/80 uppercase mb-3">Investimento</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Escolha o plano ideal para sua escola
            </h2>
            <p className="text-zinc-500">Todos os planos incluem 7 dias grátis. Cancele quando quiser.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={cn(
                  'rounded-2xl border p-6 flex flex-col relative',
                  p.popular
                    ? 'border-emerald-500/40 bg-emerald-500/[0.04] shadow-[0_0_60px_rgba(16,185,129,0.06)]'
                    : 'border-white/5 bg-white/[0.02]'
                )}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-bold text-white tracking-wide uppercase">
                    Mais popular
                  </span>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="text-xs text-zinc-500 mb-4">{p.students}</p>

                <div className="mb-1">
                  <span className="text-3xl font-extrabold">R$ {p.annualMonthly}</span>
                  <span className="text-zinc-500 text-sm">/mês</span>
                </div>
                <p className="text-[11px] text-zinc-600 mb-5">
                  no plano anual (R$ {p.annual}/ano) ou R$ {p.price}/mês
                </p>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={CTA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200',
                    p.popular
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                      : 'border border-white/10 text-white hover:border-emerald-500/30 hover:bg-emerald-500/5'
                  )}
                >
                  Começar 7 dias grátis
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-zinc-600 mt-6">
            Escola com mais de 600 alunos? <a href={CTA_URL} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">Fale conosco para um plano personalizado.</a>
          </p>
        </div>
      </section>

      {/* ═══════════════════════ GUARANTEE ═══════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Shield className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Garantia de 7 dias</h2>
          <p className="text-zinc-400 leading-relaxed">
            Teste o Safe Door por 7 dias na sua escola, com todos os recursos.
            Se não ficar satisfeito, basta cancelar. Sem burocracia, sem pergunta, sem custo.
            O risco é zero. O risco de não ter segurança na sua escola, esse sim é real.
          </p>
        </div>
      </section>

      {/* ═══════════════════════ FAQ ═══════════════════════ */}
      <section className="py-20 px-5 bg-white/[0.01]" id="faq">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Perguntas Frequentes</h2>
          </div>
          <div>
            {FAQS.map((f) => (
              <FAQItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FINAL CTA ═══════════════════════ */}
      <section className="py-24 px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-emerald-500/10 blur-[150px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
            Sua escola merece a{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              melhor segurança
            </span>
          </h2>
          <p className="text-lg text-zinc-400 mb-8 max-w-xl mx-auto">
            Junte-se às escolas que já protegem seus alunos com reconhecimento facial.
            Comece hoje — leva menos de 24 horas.
          </p>

          <div className="flex flex-col items-center gap-4">
            <CTAButton size="lg">
              <Phone className="h-5 w-5" />
              Falar com especialista agora
            </CTAButton>
            <p className="text-xs text-zinc-600">
              Atendimento imediato via WhatsApp
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer className="border-t border-white/5 py-8 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400/60" />
            <span className="text-sm font-semibold text-zinc-500">Safe Door Brasil</span>
          </div>
          <p className="text-xs text-zinc-700">
            &copy; {new Date().getFullYear()} Safe Door. Todos os direitos reservados. Conforme LGPD.
          </p>
        </div>
      </footer>

      {/* ═══════════════════════ FLOATING CTA (Mobile) ═══════════════════════ */}
      <div className="fixed bottom-0 inset-x-0 p-3 sm:hidden z-50" style={{ background: 'linear-gradient(to top, black 60%, transparent)' }}>
        <a
          href={CTA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-emerald-500 py-3.5 text-base font-semibold text-white hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
        >
          <Phone className="h-4 w-4" />
          Falar com especialista
        </a>
      </div>
    </div>
  );
}
