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
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Quando presente, o diálogo mostra um campo de texto obrigatório e
   *  resolve com o valor digitado (null se cancelado). */
  inputLabel?: string;
  inputPlaceholder?: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean | string | null) => void;
}

let enqueue: ((p: PendingConfirm) => void) | null = null;

/** Abre o diálogo e resolve true/false. Fallback para window.confirm se o host não montou. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!enqueue) {
    return Promise.resolve(window.confirm(options.title));
  }
  return new Promise((resolve) => enqueue!({ ...options, resolve: (r) => resolve(!!r) }));
}

/** Variante com campo de texto (substitui o window.prompt cru do navegador).
 *  Resolve com a string digitada, ou null se cancelado/vazio. */
export function promptDialog(options: ConfirmOptions & { inputLabel: string }): Promise<string | null> {
  if (!enqueue) {
    return Promise.resolve(window.prompt(options.title));
  }
  return new Promise((resolve) =>
    enqueue!({ ...options, resolve: (r) => resolve(typeof r === 'string' && r.trim() ? r.trim() : null) })
  );
}

/** Montado uma vez no layout; renderiza a confirmação ativa. */
export function ConfirmDialogHost() {
  const [current, setCurrent] = useState<PendingConfirm | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    enqueue = (p) => { setInputValue(''); setCurrent(p); };
    return () => { enqueue = null; };
  }, []);

  function close(confirmed: boolean) {
    if (!current) return;
    if (current.inputLabel) current.resolve(confirmed ? inputValue : null);
    else current.resolve(confirmed);
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
            {current.inputLabel && (
              <div className="space-y-1.5 mt-1">
                <label className="text-xs font-medium text-muted-foreground">{current.inputLabel}</label>
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={current.inputPlaceholder}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && inputValue.trim()) close(true); }}
                />
              </div>
            )}
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => close(false)}>
                {current.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button
                variant={current.destructive ? 'destructive' : 'default'}
                onClick={() => close(true)}
                autoFocus={!current.inputLabel}
                disabled={!!current.inputLabel && !inputValue.trim()}
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
