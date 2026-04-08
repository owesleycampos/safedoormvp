'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  ScanFace, Bell, Clock, BarChart3, Users, CheckCircle2,
  ChevronDown, ArrowRight, Play, Smartphone,
  Lock, Eye, GraduationCap, Shield,
  Minus, MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ================================================================
   SAFE DOOR — LANDING PAGE v4
   ================================================================ */

const WHATSAPP_NUMBER = '5500000000000'; // TODO: trocar
const WHATSAPP_MSG = encodeURIComponent(
  'Olá! Vi o site do Safe Door e quero implementar na minha escola.'
);
const CTA_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;

const GLOBAL_STYLES = `
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(16,185,129,0.15); }
  50% { box-shadow: 0 0 40px rgba(16,185,129,0.25); }
}
.animated-gradient-text {
  background-size: 200% auto;
  animation: gradient-shift 4s ease infinite;
}
`;

// ── Hooks ──

function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = target / (duration / 16);
    const interval = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(interval); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(interval);
  }, [started, target, duration]);

  return { count, ref };
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px]">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (card) card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('transition-[box-shadow] duration-300', className)}
      style={{ transition: 'transform 0.15s ease-out, box-shadow 0.3s ease' }}
    >
      {children}
    </div>
  );
}

// ── Data ──

const PAINS = [
  {
    icon: Clock,
    title: 'Professores perdem 15 minutos por turma fazendo chamada',
    desc: 'Tempo que deveria ser dedicado ao que importa: ensinar.',
  },
  {
    icon: Shield,
    title: 'Os pais só descobrem que o filho faltou quando é tarde demais',
    desc: 'Nenhum pai deveria passar o dia inteiro sem saber se o filho está seguro.',
  },
  {
    icon: Eye,
    title: 'A portaria não consegue controlar centenas de rostos',
    desc: 'Crachás se perdem, catracas falham. Rostos não mentem.',
  },
  {
    icon: BarChart3,
    title: 'Dados de frequência chegam com dias de atraso',
    desc: 'Quando a escola descobre que um aluno faltou 20 dias, já é tarde pra agir.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Cadastre pelo celular',
    desc: 'A escola tira as fotos dos alunos direto pelo celular. Sem câmera especial, sem equipamento caro.',
    icon: Users,
  },
  {
    num: '02',
    title: 'O rosto faz a chamada',
    desc: 'Posicione um tablet ou celular na portaria. A câmera identifica cada aluno automaticamente em menos de 2 segundos.',
    icon: ScanFace,
  },
  {
    num: '03',
    title: 'Os pais recebem na hora',
    desc: '"João chegou à escola às 07:12". Notificação direto no celular dos pais, instantaneamente.',
    icon: Bell,
  },
];

const FEATURES = [
  { icon: ScanFace, title: 'IA de reconhecimento facial', desc: '99,7% de precisão. Funciona com óculos, máscara e boné.' },
  { icon: Bell, title: 'Notificação instantânea', desc: 'Pais sabem na hora que o filho chegou ou saiu da escola.' },
  { icon: BarChart3, title: 'Dashboard em tempo real', desc: 'Frequência, atrasos e relatórios prontos para exportar.' },
  { icon: Clock, title: 'Atrasos detectados automaticamente', desc: 'O sistema sabe o horário de cada turno e marca sozinho.' },
  { icon: Smartphone, title: 'App para os pais', desc: 'Os pais baixam o app e acompanham tudo pelo celular. Rápido, leve e sempre atualizado.' },
  { icon: Users, title: 'Manhã, tarde, noite, integral', desc: 'Cada turma com seu horário. Tudo personalizável.' },
  { icon: GraduationCap, title: 'Grade horária visual', desc: 'Monte, copie e gerencie a grade de matérias facilmente.' },
  { icon: Lock, title: 'LGPD do início ao fim', desc: 'Criptografia AES-256. Servidores no Brasil. Consentimento obrigatório.' },
];

const PLANS = [
  {
    name: 'Essencial',
    students: 'Até 100 alunos',
    monthlyPrice: 497,
    annualDiscount: 0.2,
    popular: false,
    features: [
      'Reconhecimento facial ilimitado',
      'Notificações para pais',
      'Dashboard de frequência',
      'Relatórios completos',
      'App para os pais',
      'Suporte por e-mail',
    ],
  },
  {
    name: 'Profissional',
    students: 'Até 300 alunos',
    monthlyPrice: Math.round(497 * 0.8 * 3),
    annualDiscount: 0.2,
    popular: true,
    features: [
      'Tudo do Essencial +',
      'Controle de turnos',
      'Grade horária completa',
      'Relatórios avançados',
      'Alerta de alunos sem responsável',
      'Suporte prioritário WhatsApp',
    ],
  },
  {
    name: 'Premium',
    students: 'Ilimitado',
    monthlyPrice: null,
    annualDiscount: 0,
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

const FAQS = [
  { q: 'Preciso comprar câmera especial ou catraca?', a: 'Não. Um tablet ou celular com câmera frontal na portaria já funciona. Zero investimento em hardware.' },
  { q: 'Quanto tempo pra começar a usar?', a: 'O sistema fica disponível assim que o pagamento é confirmado. Basta cadastrar os alunos e pronto. Nossa equipe dá suporte em todo o processo.' },
  { q: 'E se a internet cair?', a: 'O registro manual funciona como backup. Quando a internet voltar, sincroniza automaticamente.' },
  { q: 'É seguro? E a LGPD?', a: 'Criptografia AES-256, servidores no Brasil, 100% conforme a LGPD. Os pais precisam consentir.' },
  { q: 'Como os pais acessam?', a: 'Baixando o app no celular. Leve, rápido e recebe notificações em tempo real.' },
  { q: 'Funciona com máscara ou óculos?', a: 'Sim. A IA identifica o rosto mesmo com acessórios. 99,7% de precisão.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. Sem multa, sem burocracia. Oferecemos garantia de 7 dias: se não gostar, devolvemos seu dinheiro.' },
  { q: 'Minha escola é de período integral, funciona?', a: 'Sim. O sistema suporta todos os turnos com horários 100% personalizáveis por turma.' },
];

const OBJECTIONS = [
  { obj: '"É caro demais"', answer: 'Menos de R$ 5 por aluno. Menos que a impressão da folha de chamada.' },
  { obj: '"Minha escola não precisa"', answer: 'Nenhuma escola acha que precisa até acontecer um incidente. Prevenção custa 100x menos.' },
  { obj: '"Deve ser complicado"', answer: 'Se você sabe tirar uma selfie, sabe usar. O sistema fica pronto no mesmo dia.' },
  { obj: '"E se não funcionar?"', answer: 'Garantia de 7 dias. Se não gostar, devolvemos seu dinheiro.' },
];

// ── Components ──

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('border-b border-white/[0.06]', index === 0 && 'border-t')}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="text-[15px] font-medium text-white group-hover:text-emerald-400 transition-colors">{q}</span>
        <div className={cn(
          'h-7 w-7 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 transition-all duration-300',
          open ? 'bg-emerald-500/20 border-emerald-500/30 rotate-180' : 'rotate-0'
        )}>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-colors', open ? 'text-emerald-400' : 'text-zinc-500')} />
        </div>
      </button>
      <div className={cn(
        'overflow-hidden transition-all duration-300 ease-out',
        open ? 'max-h-40 pb-5 opacity-100' : 'max-h-0 opacity-0'
      )}>
        <p className="text-sm text-zinc-400 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

function RevealSection({ children, className, delay = 0, direction = 'up' }: {
  children: React.ReactNode; className?: string; delay?: number; direction?: 'up' | 'left' | 'right';
}) {
  const { ref, visible } = useReveal();
  const translateClass = direction === 'left'
    ? (visible ? 'translate-x-0' : '-translate-x-8')
    : direction === 'right'
    ? (visible ? 'translate-x-0' : 'translate-x-8')
    : (visible ? 'translate-y-0' : 'translate-y-8');
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100' : 'opacity-0',
        translateClass,
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function formatPrice(n: number): string {
  return n.toLocaleString('pt-BR');
}

// ── Dashboard Mockup ──
function DashboardMockup() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xl">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1 rounded-lg bg-zinc-100 text-[10px] text-zinc-400">safedoor.com.br/admin</div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-zinc-400">Painel da Escola</p>
            <p className="text-sm font-bold text-zinc-900">Visão geral de hoje</p>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-[10px] text-emerald-600 font-medium">Em tempo real</div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Presentes', value: '247', color: 'text-emerald-600' },
            { label: 'Ausentes', value: '16', color: 'text-red-500' },
            { label: 'Atrasos', value: '8', color: 'text-amber-500' },
            { label: 'Saídas', value: '3', color: 'text-blue-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-zinc-50 border border-zinc-100 p-3">
              <p className="text-[10px] text-zinc-400">{s.label}</p>
              <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3">
          <p className="text-[10px] text-zinc-400 mb-2">Eventos recentes</p>
          {[
            { name: 'Maria Silva', time: '07:12', type: 'Entrada', bg: 'bg-emerald-50', tc: 'text-emerald-600', avatar: 'bg-pink-200', initials: 'MS' },
            { name: 'João Santos', time: '07:14', type: 'Entrada', bg: 'bg-emerald-50', tc: 'text-emerald-600', avatar: 'bg-blue-200', initials: 'JS' },
            { name: 'Ana Oliveira', time: '07:31', type: 'Atraso', bg: 'bg-amber-50', tc: 'text-amber-600', avatar: 'bg-purple-200', initials: 'AO' },
          ].map((e) => (
            <div key={e.name} className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0">
              <div className="flex items-center gap-2">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', e.avatar)}>
                  <span className="text-[7px] font-bold text-zinc-600">{e.initials}</span>
                </div>
                <span className="text-[11px] text-zinc-700">{e.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', e.bg, e.tc)}>{e.type}</span>
                <span className="text-[10px] text-zinc-400">{e.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── iPhone Mockup ──
function IPhoneMockup() {
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowNotif(true);
      setTimeout(() => setShowNotif(false), 4000);
    }, 5000);
    const first = setTimeout(() => setShowNotif(true), 1500);
    const firstHide = setTimeout(() => setShowNotif(false), 5500);
    return () => { clearInterval(interval); clearTimeout(first); clearTimeout(firstHide); };
  }, []);

  return (
    <div className="relative mx-auto" style={{ width: 260 }}>
      <div className="rounded-[2.5rem] border-[3px] border-zinc-300 bg-white p-2 shadow-xl">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-white z-10" />
        <div className="rounded-[2rem] bg-gradient-to-b from-zinc-50 to-white overflow-hidden relative" style={{ height: 420 }}>
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-[10px] text-zinc-500 font-medium">9:41</span>
            <div className="flex gap-1">
              <div className="w-3.5 h-2 rounded-sm bg-zinc-300" />
              <div className="w-4 h-2 rounded-sm bg-zinc-300" />
            </div>
          </div>

          {/* Push notification */}
          <div className={cn(
            'absolute top-8 left-3 right-3 transition-all duration-500 z-20',
            showNotif ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          )}>
            <div className="rounded-2xl bg-white/95 border border-zinc-200 p-3 shadow-lg backdrop-blur-xl">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src="/logo.png" alt="Safe Door" width={32} height={32} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-zinc-900">Safe Door</p>
                    <p className="text-[9px] text-zinc-400">agora</p>
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                    Maria chegou à escola às 07:12. Tudo certo!
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pt-12 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-200 border border-pink-100 mx-auto mb-2 flex items-center justify-center">
                <span className="text-sm font-bold text-pink-600">MS</span>
              </div>
              <p className="text-[13px] font-semibold text-zinc-900">Maria Silva</p>
              <p className="text-[10px] text-zinc-400">5º Ano A</p>
            </div>
            <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3">
              <p className="text-[10px] text-zinc-400 mb-2">Hoje</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-zinc-700">Entrada</span>
                </div>
                <span className="text-[11px] text-zinc-500 font-mono">07:12</span>
              </div>
            </div>
            <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3">
              <p className="text-[10px] text-zinc-400 mb-2">Frequência do mês</p>
              <div className="flex items-end gap-1">
                {[85, 100, 100, 70, 100, 90, 100, 60, 100, 100].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-emerald-400/60" style={{ height: `${h * 0.4}px` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──

export function LandingPageClient() {
  const [billingAnnual, setBillingAnnual] = useState(true);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = GLOBAL_STYLES;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <ScrollProgress />

      {/* Noise texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.025]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 512 512%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noise%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.65%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noise)%27/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }}
      />

      {/* ═══════════ NAV ═══════════ */}
      <nav className="fixed top-[3px] inset-x-0 z-50 border-b border-white/[0.04]" style={{ background: 'rgba(10,10,10,0.82)', backdropFilter: 'blur(24px) saturate(180%)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Safe Door" width={28} height={28} className="rounded-lg" />
            <span className="font-bold text-lg tracking-tight">Safe Door</span>
          </div>
          <div className="hidden sm:flex items-center gap-7 text-[13px] text-zinc-400">
            {[
              { label: 'Como funciona', id: 'como-funciona' },
              { label: 'Recursos', id: 'recursos' },
              { label: 'Preços', id: 'precos' },
              { label: 'FAQ', id: 'faq' },
            ].map((link) => (
              <button key={link.id} onClick={() => scrollTo(link.id)} className="hover:text-white transition-colors">
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative pt-20 sm:pt-28 pb-8 sm:pb-12 px-5 bg-[#0a0a0a]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full bg-emerald-500/[0.06] blur-[150px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center z-[2]">
          <h1 className="text-[1.8rem] sm:text-5xl md:text-[3.5rem] leading-[1.1] tracking-[-0.03em] mb-4 sm:mb-6">
            <span className="font-light text-zinc-300">Escolas que não</span>
            <br className="sm:hidden" />
            <span className="font-light text-zinc-300"> tiverem isso em 2026</span>{' '}
            <br className="hidden sm:block" />
            <span className="relative inline-block">
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 animated-gradient-text">
                vão ficar para trás
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400/40 to-cyan-400/40 rounded-full" />
            </span>
          </h1>

          <p className="text-sm sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-5 sm:mb-10 leading-relaxed font-light">
            Reconhecimento facial que identifica cada aluno na portaria, registra presença e avisa os pais.
          </p>

          {/* VSL */}
          <div className="relative max-w-3xl mx-auto mb-5 sm:mb-8 rounded-3xl overflow-hidden border border-white/[0.06] shadow-[0_8px_60px_rgba(0,0,0,0.5)]">
            <div className="aspect-video bg-zinc-900/80 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
              <button className="group flex flex-col items-center gap-3 sm:gap-4 relative z-10">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-emerald-500/10 group-hover:border-emerald-400/30 transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                  <Play className="h-6 w-6 sm:h-7 sm:w-7 text-white/80 ml-1 group-hover:text-emerald-400 transition-colors" fill="currentColor" />
                </div>
                <span className="text-[12px] sm:text-[13px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  Veja funcionando na prática
                </span>
              </button>
            </div>
          </div>

          {/* CTA below VSL */}
          <a
            href={CTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-8 py-3.5 sm:py-4 text-[15px] sm:text-base font-semibold rounded-2xl bg-emerald-500 text-white hover:bg-emerald-400 transition-all duration-300 hover:shadow-[0_0_50px_rgba(16,185,129,0.25)] active:scale-[0.97]"
          >
            Quero implementar na minha escola
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* ═══════════ PAIN POINTS (FUNDO BRANCO) ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-white text-zinc-900">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-red-500 uppercase mb-3 sm:mb-4">Isso precisa mudar</p>
              <h2 className="text-2xl sm:text-[2.5rem] tracking-tight leading-tight">
                <span className="font-light text-zinc-600">Enquanto sua escola faz chamada no papel,</span>
                <br className="hidden sm:block" />
                <span className="font-bold text-red-500">os alunos ficam desprotegidos</span>
              </h2>
            </div>
          </RevealSection>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {PAINS.map((p, i) => (
              <RevealSection key={p.title} delay={i * 120} direction={i % 2 === 0 ? 'left' : 'right'}>
                <TiltCard className="h-full">
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:p-7 hover:border-red-200 transition-colors duration-500 group h-full">
                    <div className="h-11 w-11 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4 group-hover:bg-red-100 transition-colors">
                      <p.icon className="h-5 w-5 text-red-500" />
                    </div>
                    <h3 className="text-[15px] font-semibold mb-2 leading-snug text-zinc-900">{p.title}</h3>
                    <p className="text-[13px] text-zinc-500 leading-relaxed">{p.desc}</p>
                  </div>
                </TiltCard>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-[#0a0a0a]" id="como-funciona">
        <div className="max-w-4xl mx-auto">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-400/70 uppercase mb-3 sm:mb-4">Simples de verdade</p>
              <h2 className="text-2xl sm:text-[2.5rem] tracking-tight leading-tight">
                <span className="font-light">Pronto para usar </span>
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 animated-gradient-text">
                  no mesmo dia
                </span>
              </h2>
            </div>
          </RevealSection>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
            {STEPS.map((s, i) => (
              <RevealSection key={s.num} delay={i * 150}>
                <TiltCard className="h-full">
                  <div className="rounded-3xl border border-white/[0.05] bg-zinc-900/40 p-6 sm:p-7 text-center h-full relative overflow-hidden group">
                    <div className="absolute top-3 right-4 text-[4rem] font-black text-white/[0.02] leading-none select-none group-hover:text-white/[0.04] transition-colors duration-500">
                      {s.num}
                    </div>
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/15 mb-5 relative z-10 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-shadow duration-500">
                      <s.icon className="h-6 w-6 text-emerald-400" />
                    </div>
                    <h3 className="text-base font-bold mb-2">{s.title}</h3>
                    <p className="text-[13px] text-zinc-500 leading-relaxed">{s.desc}</p>
                  </div>
                </TiltCard>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PAINEL DA ESCOLA ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-zinc-50 text-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <RevealSection direction="left">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-600 uppercase mb-3">Para a escola</p>
                <h2 className="text-2xl sm:text-3xl tracking-tight leading-tight mb-4">
                  <span className="font-light">Controle total </span>
                  <span className="font-extrabold">na palma da mão</span>
                </h2>
                <p className="text-zinc-500 text-[15px] leading-relaxed mb-6">
                  Veja em tempo real quem chegou, quem faltou e quem atrasou. Relatórios completos,
                  frequência por turma, alertas automáticos. Tudo num painel simples que qualquer
                  secretaria consegue usar.
                </p>
                <ul className="space-y-2.5">
                  {['Frequência em tempo real', 'Relatórios prontos para exportar', 'Alertas de atraso automáticos', 'Gestão por turno e turma'].map((t) => (
                    <li key={t} className="flex items-center gap-2.5 text-sm text-zinc-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealSection>
            <RevealSection direction="right" delay={200}>
              <DashboardMockup />
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══════════ APP DOS PAIS ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-white text-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <RevealSection direction="left" delay={200} className="order-2 md:order-1">
              <div className="flex justify-center">
                <IPhoneMockup />
              </div>
            </RevealSection>
            <RevealSection direction="right" className="order-1 md:order-2">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-600 uppercase mb-3">Para os pais</p>
                <h2 className="text-2xl sm:text-3xl tracking-tight leading-tight mb-4">
                  <span className="font-light">Tranquilidade </span>
                  <span className="font-extrabold">a cada notificação</span>
                </h2>
                <p className="text-zinc-500 text-[15px] leading-relaxed mb-6">
                  Os pais recebem uma notificação no celular no momento exato que o filho entra ou sai da escola.
                  Sem ligar pra secretaria, sem ficar na dúvida. Segurança que gera confiança.
                </p>
                <ul className="space-y-2.5">
                  {['Notificação instantânea de entrada e saída', 'Histórico completo de frequência', 'Gráfico mensal de presença', 'App disponível para baixar no celular'].map((t) => (
                    <li key={t} className="flex items-center gap-2.5 text-sm text-zinc-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══════════ BEFORE/AFTER ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto">
          <RevealSection>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
              <TiltCard>
                <div className="rounded-3xl border border-red-500/10 bg-red-500/[0.02] p-6 sm:p-7 h-full">
                  <p className="text-[11px] font-semibold tracking-[0.15em] text-red-400/60 uppercase mb-5">Sem Safe Door</p>
                  <ul className="space-y-3.5">
                    {[
                      'Chamada manual todo dia',
                      'Pais sem informação em tempo real',
                      'Frequência compilada no final do mês',
                      'Portaria sem controle real de acesso',
                      'Risco de aluno sair sem registro',
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-2.5 text-sm text-zinc-400">
                        <Minus className="h-4 w-4 text-red-400/40 flex-shrink-0 mt-0.5" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </TiltCard>
              <TiltCard>
                <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.02] p-6 sm:p-7 h-full">
                  <p className="text-[11px] font-semibold tracking-[0.15em] text-emerald-400/60 uppercase mb-5">Com Safe Door</p>
                  <ul className="space-y-3.5">
                    {[
                      'Presença registrada automaticamente',
                      'Pais notificados em segundos',
                      'Dashboard de frequência em tempo real',
                      'Cada rosto identificado na portaria',
                      'Registro de entrada e saída com hora exata',
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </TiltCard>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════ FEATURES (borda gradiente) ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-[#0a0a0a]" id="recursos">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-400/70 uppercase mb-3 sm:mb-4">Recursos</p>
              <h2 className="text-2xl sm:text-[2.5rem] tracking-tight">
                <span className="font-light">Segurança que os pais valorizam.</span>
                <br className="hidden sm:block" />
                <span className="font-bold text-emerald-400">Gestão que a escola precisa.</span>
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {FEATURES.map((f, i) => (
              <RevealSection key={f.title} delay={i * 80}>
                <TiltCard className="h-full">
                  <div className="rounded-3xl p-[1px] bg-gradient-to-b from-emerald-500/20 via-transparent to-transparent hover:from-emerald-500/40 transition-all duration-500 h-full">
                    <div className="rounded-3xl bg-zinc-900/80 p-4 sm:p-6 h-full group">
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-emerald-500/[0.12] group-hover:shadow-[0_0_15px_rgba(16,185,129,0.08)] transition-all duration-500">
                        <f.icon className="h-[18px] w-[18px] text-emerald-400/80" />
                      </div>
                      <h3 className="text-[13px] sm:text-[14px] font-semibold mb-1.5">{f.title}</h3>
                      <p className="text-[12px] sm:text-[13px] text-zinc-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </TiltCard>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ OBJECTIONS ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-zinc-950/50">
        <div className="max-w-3xl mx-auto">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-[2.5rem] tracking-tight">
                <span className="font-light">Talvez você esteja</span>{' '}
                <span className="font-bold">pensando...</span>
              </h2>
            </div>
          </RevealSection>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {OBJECTIONS.map((o, i) => (
              <RevealSection key={o.obj} delay={i * 100}>
                <TiltCard className="h-full">
                  <div className="rounded-3xl border border-white/[0.05] bg-zinc-900/50 p-6 sm:p-7 h-full">
                    <p className="text-[13px] font-semibold text-zinc-500 mb-2">{o.obj}</p>
                    <p className="text-[14px] text-zinc-200 leading-relaxed">{o.answer}</p>
                  </div>
                </TiltCard>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PRICING (FUNDO CLARO) ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-zinc-50 text-zinc-900" id="precos">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <div className="text-center mb-8 sm:mb-10">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-600 uppercase mb-3 sm:mb-4">Investimento</p>
              <h2 className="text-2xl sm:text-[2.5rem] tracking-tight mb-4">
                <span className="font-light">Quanto custa proteger seus alunos</span>
                <br className="hidden sm:block" />
                <span className="font-extrabold"> e dar segurança aos pais?</span>
              </h2>
              <p className="text-zinc-500 text-sm mb-6 sm:mb-8">Garantia de 7 dias. Cancele quando quiser.</p>

              {/* Billing toggle */}
              <div className="inline-flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-full p-1">
                <button
                  onClick={() => setBillingAnnual(false)}
                  className={cn(
                    'px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300',
                    !billingAnnual ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                  )}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setBillingAnnual(true)}
                  className={cn(
                    'px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 flex items-center gap-1.5',
                    billingAnnual ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                  )}
                >
                  Anual
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', billingAnnual ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-500')}>-20%</span>
                </button>
              </div>
            </div>
          </RevealSection>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-5 mt-6 sm:mt-10">
            {PLANS.map((p, i) => {
              const monthly = p.monthlyPrice;
              const displayPrice = monthly
                ? billingAnnual ? Math.round(monthly * (1 - p.annualDiscount)) : monthly
                : null;
              const annualTotal = monthly ? Math.round(monthly * 12 * (1 - p.annualDiscount)) : null;

              return (
                <RevealSection key={p.name} delay={i * 120}>
                  <TiltCard className="h-full">
                    <div className={cn(
                      'rounded-3xl p-[1px] h-full',
                      p.popular
                        ? 'bg-gradient-to-b from-emerald-500 via-emerald-500/30 to-transparent'
                        : 'bg-gradient-to-b from-zinc-300 via-transparent to-transparent'
                    )}>
                      <div className={cn(
                        'rounded-3xl p-6 sm:p-7 flex flex-col relative h-full',
                        p.popular ? 'bg-white' : 'bg-white'
                      )}>
                        {p.popular && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-1 text-[10px] font-bold text-white tracking-wider uppercase shadow-lg">
                            Mais escolhido
                          </span>
                        )}
                        <h3 className="text-lg font-bold text-zinc-900">{p.name}</h3>
                        <p className="text-[12px] text-zinc-400 mb-5">{p.students}</p>

                        {displayPrice ? (
                          <>
                            <div className="mb-1">
                              <span className="text-[2.5rem] font-extrabold leading-none tracking-tight text-zinc-900">
                                R$ {formatPrice(displayPrice)}
                              </span>
                              <span className="text-zinc-400 text-sm font-light">/mês</span>
                            </div>
                            {billingAnnual && annualTotal && (
                              <p className="text-[11px] text-zinc-400 mb-1">
                                R$ {formatPrice(annualTotal)}/ano (em até 12x)
                              </p>
                            )}
                            {!billingAnnual && monthly && (
                              <p className="text-[11px] text-zinc-400 mb-1">
                                ou {formatPrice(Math.round(monthly * 0.8))}/mês no plano anual
                              </p>
                            )}
                            <p className="text-[11px] text-emerald-600 mb-5">
                              = R$ {(displayPrice / (p.name === 'Profissional' ? 300 : 100)).toFixed(2).replace('.', ',')}/aluno por mês
                            </p>
                          </>
                        ) : (
                          <div className="mb-5">
                            <span className="text-2xl font-bold text-zinc-900">Sob consulta</span>
                            <p className="text-[11px] text-zinc-400 mt-1">Preço personalizado para sua escola</p>
                          </div>
                        )}

                        <ul className="space-y-3 mb-7 flex-1">
                          {p.features.map((f) => (
                            <li key={f} className="flex items-start gap-2.5 text-[13px] text-zinc-600">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                              {f}
                            </li>
                          ))}
                        </ul>

                        <a
                          href={CTA_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all duration-300',
                            p.popular
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-lg'
                              : 'border border-zinc-200 text-zinc-900 hover:border-emerald-500 hover:text-emerald-600'
                          )}
                        >
                          {displayPrice ? 'Quero implementar' : 'Falar com a equipe'}
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </TiltCard>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ GUARANTEE ═══════════ */}
      <section className="py-14 sm:py-20 px-5 bg-[#0a0a0a]">
        <RevealSection>
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/[0.08] border border-emerald-500/15 mb-5" style={{ animation: 'float 3s ease-in-out infinite' }}>
              <Shield className="h-7 w-7 text-emerald-400" />
            </div>
            <h2 className="text-2xl tracking-tight mb-4">
              <span className="font-light">Risco zero</span>{' '}
              <span className="font-bold">pra sua escola</span>
            </h2>
            <p className="text-zinc-400 leading-relaxed text-[15px]">
              Garantia de 7 dias. Se o Safe Door não fizer sentido para a sua escola,
              devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia.
              <br /><br />
              <span className="text-zinc-300 font-medium">
                O risco de não proteger seus alunos é real.
                O risco de testar o Safe Door é zero.
              </span>
            </p>
          </div>
        </RevealSection>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section className="py-14 sm:py-24 px-5 bg-zinc-950/50" id="faq">
        <div className="max-w-2xl mx-auto">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl tracking-tight">
                <span className="font-light">Dúvidas</span>{' '}
                <span className="font-bold">comuns</span>
              </h2>
            </div>
          </RevealSection>
          <RevealSection delay={100}>
            <div>
              {FAQS.map((f, i) => (
                <FAQItem key={f.q} q={f.q} a={f.a} index={i} />
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-16 sm:py-28 px-5 relative overflow-hidden bg-[#0a0a0a]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full bg-emerald-500/[0.07] blur-[180px]" />
        </div>

        <RevealSection>
          <div className="relative max-w-3xl mx-auto text-center z-[2]">
            <h2 className="text-2xl sm:text-4xl md:text-5xl tracking-tight leading-tight mb-5 sm:mb-6">
              <span className="font-light">Pare de arriscar.</span>{' '}
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 animated-gradient-text">
                Comece a proteger.
              </span>
            </h2>
            <p className="text-base sm:text-lg text-zinc-400 mb-8 sm:mb-10 max-w-xl mx-auto font-light">
              O sistema fica pronto no mesmo dia. Garantia de 7 dias. Zero motivo para esperar.
            </p>

            <a
              href={CTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-semibold rounded-2xl bg-emerald-500 text-white hover:bg-emerald-400 transition-all duration-300 hover:shadow-[0_0_60px_rgba(16,185,129,0.25)] active:scale-[0.97]"
              style={{ animation: 'pulse-glow 3s ease infinite' }}
            >
              Quero implementar agora
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </RevealSection>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-white/[0.04] py-8 sm:py-10 px-5 bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Safe Door" width={20} height={20} className="rounded-lg opacity-60" />
            <span className="text-sm font-semibold text-zinc-600">Safe Door Brasil</span>
          </div>
          <p className="text-[11px] text-zinc-700">
            &copy; {new Date().getFullYear()} Safe Door. Todos os direitos reservados. Conforme LGPD.
          </p>
        </div>
      </footer>

      {/* ═══════════ FLOATING WhatsApp (Mobile) ═══════════ */}
      <div className="fixed bottom-0 inset-x-0 p-3 sm:hidden z-50" style={{ background: 'linear-gradient(to top, #0a0a0a 70%, transparent)' }}>
        <a
          href={CTA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-emerald-500 py-3.5 text-[15px] font-semibold text-white active:scale-[0.97] transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
        >
          <MessageCircle className="h-4 w-4" />
          Quero implementar
        </a>
      </div>

      {/* ═══════════ FLOATING WhatsApp (Desktop) ═══════════ */}
      <a
        href={CTA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:flex fixed bottom-6 right-6 z-50 h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400 hover:scale-110 transition-all duration-300"
        title="Falar pelo WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
}
