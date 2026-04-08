'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Circle, ChevronDown, ChevronUp, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  key: string;
  label: string;
  completed: boolean;
  href: string;
}

interface OnboardingStatus {
  steps: OnboardingStep[];
  progress: number;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  { key: 'classes', label: 'Criar primeira turma', completed: false, href: '/admin/classes' },
  { key: 'students', label: 'Adicionar alunos', completed: false, href: '/admin/students' },
  { key: 'photos', label: 'Upload de fotos', completed: false, href: '/admin/students' },
  { key: 'parents', label: 'Vincular responsáveis', completed: false, href: '/admin/parents' },
  { key: 'devices', label: 'Configurar câmera', completed: false, href: '/admin/camera' },
];

export function OnboardingChecklist() {
  const [status, setStatus] = useState<OnboardingStatus>({
    steps: DEFAULT_STEPS,
    progress: 0,
  });
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('onboarding_dismissed');
      if (stored === 'true') {
        setDismissed(true);
        return;
      }
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/onboarding/status');
        if (res.ok) {
          const data: OnboardingStatus = await res.json();
          setStatus(data);
        }
      } catch {
        // API pode não existir ainda, usar valores padrão
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_dismissed', 'true');
    }
  }

  if (dismissed || (status.progress === 100 && !loading)) return null;

  const completedCount = status.steps.filter((s) => s.completed).length;
  const totalCount = status.steps.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed bottom-4 right-4 z-50 max-w-[280px]"
      >
        <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Progress circle */}
              <div className="relative h-6 w-6 shrink-0">
                <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="hsl(var(--foreground))"
                    strokeWidth="2"
                    strokeDasharray={`${(status.progress / 100) * 62.83} 62.83`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-xs font-semibold truncate">
                Configuração inicial
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setMinimized(!minimized)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {minimized ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-3 pb-2">
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-foreground rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${status.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {completedCount} de {totalCount} concluídos
            </p>
          </div>

          {/* Checklist */}
          <AnimatePresence>
            {!minimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-0.5">
                  {status.steps.map((step) => (
                    <Link
                      key={step.key}
                      href={step.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent',
                        step.completed && 'text-muted-foreground'
                      )}
                    >
                      {step.completed ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      )}
                      <span
                        className={cn(
                          step.completed && 'line-through'
                        )}
                      >
                        {step.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
