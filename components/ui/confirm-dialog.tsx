'use client';

/**
 * Confirmação própria no lugar do window.confirm().
 *
 * O produto tinha 15 diálogos estilizados e usava o alerta cru do navegador
 * exatamente nas ações destrutivas — que no celular aparece como um popup
 * genérico do sistema, fácil de bloquear e fora da identidade visual.
 *
 * Uso imperativo, para caber onde o confirm() estava sem reestruturar nada:
 *
 *   const confirmed = await confirmDialog({
 *     title: 'Excluir turma "3º A"?',
 *     description: 'Esta ação não pode ser desfeita.',
 *     confirmLabel: 'Excluir',
 *     destructive: true,
 *   });
 *   if (!confirmed) return;
 */
import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

let enqueue: ((p: PendingConfirm) => void) | null = null;

/** Abre o diálogo e resolve true/false. Fallback para window.confirm se o host não montou. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!enqueue) {
    return Promise.resolve(window.confirm(options.title));
  }
  return new Promise((resolve) => enqueue!({ ...options, resolve }));
}

/** Montado uma vez no layout; renderiza a confirmação ativa. */
export function ConfirmDialogHost() {
  const [current, setCurrent] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    enqueue = (p) => setCurrent(p);
    return () => { enqueue = null; };
  }, []);

  function close(confirmed: boolean) {
    current?.resolve(confirmed);
    setCurrent(null);
  }

  return (
    <Dialog open={!!current} onOpenChange={(open) => { if (!open) close(false); }}>
      <DialogContent className="sm:max-w-sm">
        {current && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                {current.destructive && (
                  <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                )}
                <div>
                  <DialogTitle className="text-base">{current.title}</DialogTitle>
                  {current.description && (
                    <DialogDescription className="mt-1">{current.description}</DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => close(false)}>
                {current.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button
                variant={current.destructive ? 'destructive' : 'default'}
                onClick={() => close(true)}
                autoFocus
              >
                {current.confirmLabel ?? 'Confirmar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
