'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useMotionValue,
  animate,
} from 'framer-motion';
import {
  ScanFace,
  ClipboardCheck,
  Bell,
  Shield,
  Lock,
  Server,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ArrowRight,
  Plus,
  X,
  Quote,
  Zap,
  Eye,
  Database,
  Headphones,
  Clock,
  BarChart3,
  FileText,
  Users,
  Sparkles,
} from 'lucide-react';

/* ================================================================
   SAFE DOOR BRASIL — LANDING PAGE v5
   Monochrome + subtle blue accent. framer-motion powered.
   ================================================================ */

// ─── Constants ─────────────────────────────────────────────────
const CTA_URL = '/auth/login';

// ─── Global CSS (injected once) ────────────────────────────────
const GLOBAL_STYLES = `
@keyframes meshBlob1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(80px, -60px) scale(1.1); }
  50% { transform: translate(-40px, 80px) scale(0.95); }
  75% { transform: translate(60px, 40px) scale(1.05); }
}
@keyframes meshBlob2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-60px, 40px) scale(0.95); }
  50% { transform: translate(80px, -30px) scale(1.1); }
  75% { transform: translate(-40px, -60px) scale(1); }
}
@keyframes meshBlob3 {
  0%, 100% { transform: translate(0, 0) scale(1.05); }
  33% { transform: translate(50px, 70px) scale(0.9); }
  66% { transform: translate(-70px, -30px) scale(1.1); }
}
@keyframes shineSweep {
  0% { transform: translateX(-100%) skewX(-15deg); }
  100% { transform: translateX(300%) skewX(-15deg); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.1); }
  50% { box-shadow: 0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.2); }
}
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes floatSlow {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
@keyframes floatMedium {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(3deg); }
}
`;

// ─── Reusable Components ───────────────────────────────────────

function ScrollSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(8px)', y: 20 }}
      whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GlowButton({
  children,
  href,
  variant = 'primary',
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  variant?: 'primary' | 'outline';
  className?: string;
  onClick?: () => void;
}) {
  const base =
    variant === 'primary'
      ? 'relative overflow-hidden bg-white text-[#0A0A0A] font-semibold px-8 py-4 rounded-xl text-base transition-all duration-300 hover:scale-[1.02]'
      : 'relative overflow-hidden border border-white/20 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-300 hover:bg-white/5 hover:border-white/40';

  const inner = (
    <span className={`${base} ${className} inline-flex items-center gap-2`} style={variant === 'primary' ? { animation: 'glowPulse 3s ease-in-out infinite' } : {}}>
      {children}
      {variant === 'primary' && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.15), transparent)',
            animation: 'shineSweep 3s ease-in-out infinite',
          }}
        />
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return <button onClick={onClick}>{inner}</button>;
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-16">
      {eyebrow && (
        <span className="inline-block text-sm font-medium tracking-widest uppercase text-blue-400 mb-4">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">{title}</h2>
      {subtitle && <p className="text-lg text-neutral-400 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

// ─── Counter Animation Hook ───────────────────────────────────
function AnimatedCounter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionVal, value, {
      duration: 2,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return controls.stop;
  }, [isInView, value, motionVal]);

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  );
}

// ─── Typewriter Hook ──────────────────────────────────────────
function useTypewriter(words: string[], typingSpeed = 80, deletingSpeed = 40, pauseTime = 2000) {
  const [text, setText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setText(currentWord.slice(0, text.length + 1));
          if (text.length + 1 === currentWord.length) {
            setTimeout(() => setIsDeleting(true), pauseTime);
          }
        } else {
          setText(currentWord.slice(0, text.length - 1));
          if (text.length === 0) {
            setIsDeleting(false);
            setWordIndex((prev) => (prev + 1) % words.length);
          }
        }
      },
      isDeleting ? deletingSpeed : typingSpeed,
    );

    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseTime]);

  return text;
}

// ─── FAQ Data ─────────────────────────────────────────────────
const FAQ_DATA = [
  {
    q: 'Como funciona o reconhecimento facial?',
    a: 'Utilizamos inteligencia artificial avancada para identificar cada aluno no momento em que ele passa pela camera. O processo leva menos de 2 segundos e funciona mesmo com mascara, oculos ou mudancas no visual.',
  },
  {
    q: 'Preciso instalar algum hardware especial?',
    a: 'Nao. O Safe Door funciona com cameras IP comuns ou ate webcams. Voce pode comecar com o equipamento que ja tem na escola. Nos fornecemos orientacao completa sobre posicionamento e configuracao.',
  },
  {
    q: 'Os dados dos alunos estao seguros?',
    a: 'Sim. Todos os dados sao criptografados com AES-256, armazenados em servidores AWS no Brasil e tratados em total conformidade com a LGPD. Pais podem solicitar exclusao dos dados a qualquer momento.',
  },
  {
    q: 'Quanto tempo leva para implementar?',
    a: 'A implementacao basica leva de 24 a 48 horas. Isso inclui configuracao do sistema, cadastro dos alunos (via foto), treinamento da equipe e primeiros testes. Oferecemos suporte completo durante todo o processo.',
  },
  {
    q: 'Funciona com qualquer tamanho de escola?',
    a: 'Sim. O Safe Door foi projetado para escalar de pequenas creches com 30 alunos ate redes escolares com milhares de estudantes. Os planos sao flexiveis e crescem junto com a sua instituicao.',
  },
  {
    q: 'Os pais precisam instalar algum aplicativo?',
    a: 'Nao. As notificacoes sao enviadas por WhatsApp e email. Os pais tambem podem acessar o painel pelo navegador do celular para acompanhar o historico de presenca do filho.',
  },
];

// ─── Testimonials ─────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'O Safe Door transformou a forma como gerenciamos a presenca. Os pais adoram receber notificacao em tempo real quando o filho chega na escola.',
    name: 'Maria Silva',
    role: 'Diretora',
    school: 'Colegio Novo Horizonte',
  },
  {
    quote: 'Reduzimos o tempo de chamada de 15 minutos para zero. Os professores agora usam esse tempo para ensinar. Foi a melhor decisao que tomamos.',
    name: 'Carlos Oliveira',
    role: 'Coordenador Pedagogico',
    school: 'Escola Estrela do Saber',
  },
  {
    quote: 'A seguranca da escola melhorou drasticamente. Sabemos exatamente quem esta no campus a qualquer momento. Os pais confiam mais na nossa instituicao.',
    name: 'Ana Beatriz Costa',
    role: 'Proprietaria',
    school: 'Instituto Educacional ABC',
  },
];

// ─── Pricing ──────────────────────────────────────────────────
const PRICING = [
  {
    name: 'Starter',
    price: 'R$ 297',
    period: '/mes',
    description: 'Para escolas pequenas',
    features: ['Ate 100 alunos', 'Reconhecimento facial', 'Notificacoes WhatsApp', 'Painel basico', 'Suporte por email', '1 camera'],
    highlight: false,
  },
  {
    name: 'Professional',
    price: 'R$ 597',
    period: '/mes',
    description: 'Para escolas em crescimento',
    features: ['Ate 500 alunos', 'Tudo do Starter', 'Relatorios avancados', 'Multiplas cameras', 'Suporte prioritario', 'API de integracao', 'Multi-turnos'],
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    description: 'Para redes de ensino',
    features: ['Alunos ilimitados', 'Tudo do Professional', 'Gerente de conta dedicado', 'SLA garantido', 'Integracao ERP/SIS', 'Servidores dedicados', 'Treinamento presencial'],
    highlight: false,
  },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function LandingPageClient() {
  const typedText = useTypewriter(
    ['reconhecimento facial', 'presenca automatica', 'paz para os pais'],
    70,
    35,
    2200,
  );

  const { scrollYProgress } = useScroll();
  const [showFloatingCta, setShowFloatingCta] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Parallax transforms
  const parallax1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const parallax2 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const parallax3 = useTransform(scrollYProgress, [0, 1], [0, -80]);

  // Show floating CTA after 40% scroll
  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      setShowFloatingCta(v > 0.15);
    });
    return unsub;
  }, [scrollYProgress]);

  // Inject global styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = GLOBAL_STYLES;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden font-[Inter,sans-serif]">

      {/* ══════════════ PARALLAX FLOATING ELEMENTS ══════════════ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          style={{ y: parallax1 }}
          className="absolute top-[20%] left-[10%] w-2 h-2 rounded-full bg-blue-500/20"
        />
        <motion.div
          style={{ y: parallax2 }}
          className="absolute top-[35%] right-[15%] w-3 h-3 rounded-full border border-white/5"
        />
        <motion.div
          style={{ y: parallax3 }}
          className="absolute top-[55%] left-[80%] w-1.5 h-1.5 rounded-full bg-white/10"
        />
        <motion.div
          style={{ y: parallax1 }}
          className="absolute top-[70%] left-[25%] w-4 h-4 rounded-full border border-blue-500/10"
        />
        <motion.div
          style={{ y: parallax2 }}
          className="absolute top-[45%] left-[55%] w-2 h-2 rounded-full bg-white/5"
        />
        <motion.div
          style={{ y: parallax3 }}
          className="absolute top-[80%] right-[30%] w-6 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        {/* Grid dots */}
        <motion.div
          style={{ y: parallax1 }}
          className="absolute top-[15%] right-[40%] grid grid-cols-3 gap-4 opacity-[0.04]"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white" />
          ))}
        </motion.div>
        <motion.div
          style={{ y: parallax2 }}
          className="absolute top-[60%] left-[5%] grid grid-cols-4 gap-3 opacity-[0.03]"
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white" />
          ))}
        </motion.div>
      </div>

      {/* ══════════════ NAVIGATION ══════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Safe Door" width={26} height={26} className="object-contain" />
            <span className="font-semibold text-base tracking-tight text-white leading-none">Safe Door</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
            <button onClick={() => scrollTo('como-funciona')} className="hover:text-white transition-colors">
              Como Funciona
            </button>
            <button onClick={() => scrollTo('precos')} className="hover:text-white transition-colors">
              Precos
            </button>
            <button onClick={() => scrollTo('faq')} className="hover:text-white transition-colors">
              FAQ
            </button>
          </div>

          <GlowButton href={CTA_URL} className="!px-5 !py-2.5 !text-sm">
            Comecar Agora
            <ArrowRight className="w-4 h-4" />
          </GlowButton>
        </div>
      </nav>

      {/* ══════════════ HERO SECTION ══════════════ */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Animated Gradient Mesh Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.07]"
            style={{
              background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
              animation: 'meshBlob1 20s ease-in-out infinite',
            }}
          />
          <div
            className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full opacity-[0.05]"
            style={{
              background: 'radial-gradient(circle, #6b7280 0%, transparent 70%)',
              animation: 'meshBlob2 25s ease-in-out infinite',
            }}
          />
          <div
            className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.06]"
            style={{
              background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
              animation: 'meshBlob3 22s ease-in-out infinite',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-32 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-neutral-300 mb-8">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Tecnologia de ponta para escolas
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6">
              <span className="text-white">Seguranca escolar com</span>
              <br />
              <span className="text-blue-400">
                {typedText}
                <span
                  className="inline-block w-[3px] h-[0.85em] bg-blue-400 ml-1 align-middle"
                  style={{ animation: 'cursorBlink 1s step-end infinite' }}
                />
              </span>
            </h1>

            <p className="text-lg md:text-xl text-neutral-400 max-w-xl mb-10 leading-relaxed">
              Reconhecimento facial que registra presenca automaticamente e notifica os pais em tempo real. Sem catracas, sem papel, sem complicacao.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <GlowButton href={CTA_URL}>
                Comecar Agora
                <ArrowRight className="w-5 h-5" />
              </GlowButton>
              <GlowButton variant="outline" onClick={() => scrollTo('como-funciona')}>
                Ver Como Funciona
              </GlowButton>
            </div>

            <div className="flex items-center gap-6 mt-10 text-sm text-neutral-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Setup em 24h
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Sem hardware especial
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Teste gratis
              </span>
            </div>
          </motion.div>

          {/* Right - Dashboard Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div
              className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-2xl"
              style={{ animation: 'floatSlow 6s ease-in-out infinite' }}
            >
              {/* Fake top bar */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <div className="flex-1" />
                <span className="text-xs text-neutral-600">dashboard.safedoor.com.br</span>
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Presentes Hoje', value: '347', change: '+12' },
                  { label: 'Taxa de Presenca', value: '96.2%', change: '+2.1%' },
                  { label: 'Notificacoes', value: '892', change: 'enviadas' },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-neutral-500 mb-1">{kpi.label}</p>
                    <p className="text-2xl font-bold text-white">{kpi.value}</p>
                    <p className="text-xs text-green-400 mt-1">{kpi.change}</p>
                  </div>
                ))}
              </div>

              {/* Fake Chart */}
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs text-neutral-500 mb-3">Presenca Semanal</p>
                <div className="flex items-end gap-2 h-24">
                  {[65, 78, 82, 70, 88, 92, 85].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                      className="flex-1 bg-gradient-to-t from-blue-500/40 to-blue-500/10 rounded-t-md"
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-neutral-600">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div className="mt-4 space-y-2">
                {[
                  { name: 'Lucas Mendes', time: '07:32', status: 'Entrada' },
                  { name: 'Sofia Santos', time: '07:34', status: 'Entrada' },
                  { name: 'Pedro Almeida', time: '07:35', status: 'Entrada' },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <ScanFace className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <span className="text-neutral-300">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-600">{item.time}</span>
                      <span className="text-xs text-green-400">{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
      </section>

      {/* ══════════════ STATS ══════════════ */}
      <section className="relative z-10 py-20 border-y border-white/5">
        <ScrollSection>
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 98, suffix: '%', label: 'Precisao' },
              { value: 2, prefix: '< ', suffix: 's', label: 'Reconhecimento' },
              { value: 24, suffix: '/7', label: 'Monitoramento' },
              { value: 0, suffix: '', label: 'Papel', displayOverride: '0' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {stat.displayOverride ? (
                    stat.displayOverride
                  ) : (
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} prefix={stat.prefix || ''} />
                  )}
                </p>
                <p className="text-sm text-neutral-500 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </ScrollSection>
      </section>

      {/* ══════════════ COMO FUNCIONA ══════════════ */}
      <section id="como-funciona" className="relative z-10 py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollSection>
            <SectionTitle
              eyebrow="Como Funciona"
              title="Tres passos simples"
              subtitle="Da instalacao da camera ate a notificacao do pai. Tudo automatico, tudo em tempo real."
            />
          </ScrollSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: ScanFace,
                title: 'Camera detecta',
                desc: 'A camera identifica o rosto do aluno no momento em que ele entra na escola. Sem filas, sem contato.',
              },
              {
                step: '02',
                icon: ClipboardCheck,
                title: 'Presenca registrada',
                desc: 'O sistema registra automaticamente a presenca com horario exato. Dados armazenados com seguranca na nuvem.',
              },
              {
                step: '03',
                icon: Bell,
                title: 'Pais notificados',
                desc: 'Os pais recebem notificacao instantanea por WhatsApp ou email confirmando a chegada do filho.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="bg-white/[0.03] border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-all duration-300 group"
              >
                <span className="text-6xl font-bold text-white/[0.04] absolute -top-2 -left-1 select-none">{item.step}</span>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                  <item.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-neutral-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ BEFORE / AFTER ══════════════ */}
      <section className="relative z-10 py-24 md:py-32 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollSection>
            <SectionTitle
              eyebrow="Transformacao"
              title="Antes vs Depois do Safe Door"
              subtitle="Veja como a sua rotina escolar muda completamente."
            />
          </ScrollSection>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Before */}
            <motion.div
              initial={{ opacity: 0, x: -40, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="bg-[#111] border border-white/5 rounded-2xl p-8"
            >
              <h3 className="text-xl font-semibold text-red-400/80 mb-6 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Antes
              </h3>
              <div className="space-y-4">
                {[
                  'Chamada manual em papel',
                  '15 minutos perdidos por turma',
                  'Pais sem informacao em tempo real',
                  'Registros imprecisos e extraviados',
                  'Sem controle de quem esta na escola',
                  'Comunicacao lenta e burocracia',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-500/50 mt-0.5 flex-shrink-0" />
                    <span className="text-neutral-400">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* After */}
            <motion.div
              initial={{ opacity: 0, x: 40, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="bg-[#111] border border-blue-500/20 rounded-2xl p-8"
            >
              <h3 className="text-xl font-semibold text-green-400/80 mb-6 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Depois
              </h3>
              <div className="space-y-4">
                {[
                  'Reconhecimento facial automatico',
                  'Presenca registrada em menos de 2s',
                  'Notificacao instantanea para os pais',
                  'Dados 100% digitais e seguros',
                  'Controle total de acesso em tempo real',
                  'Relatorios automaticos e inteligentes',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500/70 mt-0.5 flex-shrink-0" />
                    <span className="text-neutral-300">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════ SECURITY / COMPLIANCE ══════════════ */}
      <section className="relative z-10 py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollSection>
            <SectionTitle
              eyebrow="Seguranca e Conformidade"
              title="Seus dados estao protegidos"
              subtitle="Infraestrutura de nivel enterprise para proteger os dados dos seus alunos."
            />
          </ScrollSection>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[
              { icon: Shield, label: 'LGPD Compliant', desc: 'Total conformidade com a lei brasileira' },
              { icon: Lock, label: 'Criptografia AES-256', desc: 'Dados criptografados em repouso e transito' },
              { icon: Server, label: 'Servidores AWS Brasil', desc: 'Dados armazenados em territorio nacional' },
              { icon: Database, label: 'Backup Automatico', desc: 'Backups diarios com retencao de 90 dias' },
              { icon: Zap, label: '99.9% Uptime', desc: 'Infraestrutura redundante e monitorada' },
              { icon: Headphones, label: 'Suporte Dedicado', desc: 'Atendimento humano em horario comercial' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-6 text-center hover:border-white/10 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="font-semibold text-white text-sm mb-1">{item.label}</h4>
                <p className="text-xs text-neutral-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ TESTIMONIALS ══════════════ */}
      <section className="relative z-10 py-24 md:py-32 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollSection>
            <SectionTitle
              eyebrow="Depoimentos"
              title="O que dizem nossos clientes"
              subtitle="Escolas que ja transformaram sua gestao de presenca."
            />
          </ScrollSection>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="bg-[#111] border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-all duration-300 group"
              >
                <Quote className="w-8 h-8 text-blue-500/20 mb-4" />
                <p className="text-neutral-300 leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-600/10 flex items-center justify-center text-sm font-semibold text-blue-400">
                    {t.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.role} - {t.school}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ PRICING ══════════════ */}
      <section id="precos" className="relative z-10 py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollSection>
            <SectionTitle
              eyebrow="Precos"
              title="Planos para cada escola"
              subtitle="Comece pequeno e escale conforme sua necessidade. Sem fidelidade."
            />
          </ScrollSection>

          <div className="grid md:grid-cols-3 gap-8">
            {PRICING.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className={`rounded-2xl p-8 transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-[#111] border-2 border-blue-500/40 relative'
                    : 'bg-white/[0.03] border border-white/5 hover:border-white/10'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    Mais Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-neutral-500 mb-6">{plan.description}</p>
                <div className="mb-8">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-neutral-500 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-neutral-300">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <GlowButton
                  href={CTA_URL}
                  variant={plan.highlight ? 'primary' : 'outline'}
                  className="!w-full !justify-center"
                >
                  {plan.name === 'Enterprise' ? 'Falar com Vendas' : 'Comecar Agora'}
                </GlowButton>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ FAQ ══════════════ */}
      <section id="faq" className="relative z-10 py-24 md:py-32 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto px-6">
          <ScrollSection>
            <SectionTitle
              eyebrow="FAQ"
              title="Perguntas frequentes"
              subtitle="Tire suas duvidas sobre o Safe Door."
            />
          </ScrollSection>

          <div className="space-y-3">
            {FAQ_DATA.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="border border-white/5 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-medium text-white pr-4">{item.q}</span>
                  <motion.div
                    animate={{ rotate: openFaq === i ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Plus className="w-5 h-5 text-neutral-500 flex-shrink-0" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-neutral-400 leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ FINAL CTA ══════════════ */}
      <section className="relative z-10 py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <ScrollSection>
            <div className="bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10 rounded-3xl p-12 md:p-20">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Pronto para modernizar <br className="hidden md:block" /> sua escola?
              </h2>
              <p className="text-lg text-neutral-400 mb-10 max-w-xl mx-auto">
                Junte-se as escolas que ja usam reconhecimento facial para garantir seguranca e tranquilidade para pais e educadores.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <GlowButton href={CTA_URL}>
                  Comecar Agora - Gratis
                  <ArrowRight className="w-5 h-5" />
                </GlowButton>
                <GlowButton variant="outline" onClick={() => scrollTo('precos')}>
                  Ver Planos
                </GlowButton>
              </div>
            </div>
          </ScrollSection>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="relative z-10 border-t border-white/5 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Logo + description */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <Image src="/logo.png" alt="Safe Door" width={26} height={26} className="object-contain" />
                <span className="font-semibold text-base tracking-tight text-white">Safe Door</span>
              </div>
              <p className="text-sm text-neutral-500 max-w-sm leading-relaxed">
                Reconhecimento facial para escolas. Seguranca, presenca automatica e comunicacao com os pais em uma unica plataforma.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><button onClick={() => scrollTo('como-funciona')} className="hover:text-white transition-colors">Como Funciona</button></li>
                <li><button onClick={() => scrollTo('precos')} className="hover:text-white transition-colors">Precos</button></li>
                <li><button onClick={() => scrollTo('faq')} className="hover:text-white transition-colors">FAQ</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><span className="hover:text-white transition-colors cursor-pointer">Termos de Uso</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">Politica de Privacidade</span></li>
                <li><span className="hover:text-white transition-colors cursor-pointer">LGPD</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-600">
              &copy; {new Date().getFullYear()} Safe Door Brasil. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-neutral-600 hover:text-white transition-colors" aria-label="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="#" className="text-neutral-600 hover:text-white transition-colors" aria-label="LinkedIn">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ══════════════ FLOATING CTA BAR ══════════════ */}
      <AnimatePresence>
        {showFloatingCta && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-white/10 py-3 px-6 md:hidden"
          >
            <GlowButton href={CTA_URL} className="!w-full !justify-center">
              Comecar Agora
              <ArrowRight className="w-4 h-4" />
            </GlowButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop floating CTA */}
      <AnimatePresence>
        {showFloatingCta && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 hidden md:block"
          >
            <GlowButton href={CTA_URL}>
              Comecar Agora
              <ArrowRight className="w-4 h-4" />
            </GlowButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
