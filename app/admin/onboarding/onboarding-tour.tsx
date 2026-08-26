'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Users, Camera, Link2, MonitorSmartphone, ScanFace, Bell,
  ArrowRight, ArrowLeft, Check,
} from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';

/**
 * Tutorial guiado do primeiro acesso, na identidade visual do produto.
 * Explica o caminho e leva o proprietário para a primeira ação real.
 */
const STEPS = [
  {
    icon: GraduationCap,
    title: 'Crie suas turmas',
    body: 'Tudo começa pelas turmas. Depois, cada aluno entra em uma delas. Você pode importar uma planilha inteira de uma vez.',
    to: '/admin/classes',
    cta: 'Ir para turmas',
  },
  {
    icon: Users,
    title: 'Cadastre os alunos',
    body: 'Nome e data de nascimento bastam para começar. A data de nascimento é o que o responsável usa para provar o vínculo depois.',
    to: '/admin/students',
    cta: 'Ir para alunos',
  },
  {
    icon: Camera,
    title: 'Adicione as fotos',
    body: 'Algumas fotos boas de cada rosto ensinam o reconhecimento. Quanto melhor a foto, mais preciso o reconhecimento na portaria.',
    to: '/admin/students',
    cta: 'Ir para alunos',
  },
  {
    icon: Link2,
    title: 'Convide os responsáveis',
    body: 'Gere um único link por turma e mande no grupo de WhatsApp. Cada responsável abre, confirma a data de nascimento do filho e cria a própria senha.',
    to: '/admin/classes',
    cta: 'Ver turmas',
  },
  {
    icon: MonitorSmartphone,
    title: 'Abra a câmera na portaria',
    body: 'Abra o menu Câmera em um tablet ou computador na portaria, escolha entrada ou saída, e pronto. Cada rosto reconhecido registra a presença e avisa o responsável.',
    to: '/admin/camera',
    cta: 'Ver a câmera',
  },
];

export function OnboardingTour({ schoolName, ownerName }: { schoolName: string; ownerName: string }) {
  const router = useRouter();
  const [i, setI] = useState(-1); // -1 = tela de boas-vindas
  const [finishing, setFinishing] = useState(false);

  async function finish(to?: string) {
    setFinishing(true);
    await fetch('/api/onboarding/complete', { method: 'POST' }).catch(() => {});
    router.push(to || '/admin/dashboard');
    router.refresh();
  }

  const step = i >= 0 ? STEPS[i] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="sm" showText />
        </div>

        <AnimatePresence mode="wait">
          {i === -1 ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="text-center space-y-4"
            >
              <div className="mx-auto h-14 w-14 rounded-2xl bg-accent flex items-center justify-center">
                <ScanFace className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {ownerName ? `Boas-vindas, ${ownerName.split(' ')[0]}.` : 'Boas-vindas.'}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Vamos preparar a {schoolName} em cinco passos rápidos. Em poucos minutos os responsáveis já acompanham a entrada e a saída dos filhos em tempo real.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full" onClick={() => setI(0)}>
                  Começar <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
                <button
                  onClick={() => finish()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pular e ir para o painel
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Progresso */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, n) => (
                  <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= i ? 'bg-foreground' : 'bg-border'}`} />
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center">
                  {step && <step.icon className="h-5 w-5" />}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Passo {i + 1} de {STEPS.length}</p>
                  <h2 className="text-lg font-semibold tracking-tight">{step?.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step?.body}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setI(i - 1)} className="flex-shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {i < STEPS.length - 1 ? (
                  <Button className="flex-1" onClick={() => setI(i + 1)}>
                    Próximo <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                ) : (
                  <Button className="flex-1" loading={finishing} onClick={() => finish('/admin/dashboard')}>
                    <Check className="h-4 w-4 mr-1.5" /> Concluir
                  </Button>
                )}
              </div>

              <button
                onClick={() => step && finish(step.to)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {step?.cta} agora
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
