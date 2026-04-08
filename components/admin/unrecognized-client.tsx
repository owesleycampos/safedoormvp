'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Eye, ScanFace, Clock, Tablet, Camera, ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { cn, formatDateTime, formatRelativeTime, formatConfidence } from '@/lib/utils';

interface LogDevice { id: string; name: string; type: string; }
interface LogItem {
  id: string;
  timestamp: Date | string;
  photoUrl: string;
  confidenceScore: number | null;
  reviewed: boolean;
  reviewedAt: Date | string | null;
  notes: string | null;
  device: LogDevice;
}

interface UnrecognizedClientProps { logs: LogItem[]; }
type FilterMode = 'all' | 'pending' | 'reviewed';

export function UnrecognizedClient({ logs: initialLogs }: UnrecognizedClientProps) {
  const [logs, setLogs] = useState<LogItem[]>(initialLogs);
  const [filter, setFilter] = useState<FilterMode>('pending');
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const filtered = logs.filter((l) => {
    if (filter === 'pending') return !l.reviewed;
    if (filter === 'reviewed') return l.reviewed;
    return true;
  });

  const pendingCount = logs.filter(l => !l.reviewed).length;

  async function markReviewed(log: LogItem) {
    if (log.reviewed) return;
    setMarkingId(log.id);
    try {
      const res = await fetch(`/api/unrecognized/${log.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, reviewed: true, reviewedAt: new Date().toISOString() } : l));
      if (selectedLog?.id === log.id) {
        setSelectedLog(prev => prev ? { ...prev, reviewed: true, reviewedAt: new Date().toISOString() } : null);
      }
      toast({ variant: 'success', title: 'Marcado como revisado' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally { setMarkingId(null); }
  }

  async function markAllReviewed() {
    const pending = logs.filter(l => !l.reviewed);
    if (pending.length === 0) return;
    if (!confirm(`Marcar todos os ${pending.length} registros pendentes como revisados?`)) return;
    setMarkingAll(true);
    try {
      const res = await fetch('/api/unrecognized/review-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pending.map(l => l.id) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reviewedAt = new Date().toISOString();
      setLogs(prev => prev.map(l => !l.reviewed ? { ...l, reviewed: true, reviewedAt } : l));
      toast({ variant: 'success', title: 'Todos revisados', description: `${pending.length} registro${pending.length !== 1 ? 's' : ''} revisado${pending.length !== 1 ? 's' : ''}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally { setMarkingAll(false); }
  }

  return (
    <>
      <div className="flex-1 p-5 md:p-8 space-y-6 max-w-[1200px]">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Não Identificados</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''} · {logs.length} registro{logs.length !== 1 ? 's' : ''} total
            </p>
          </div>
          {pendingCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllReviewed} loading={markingAll}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Revisar todos
            </Button>
          )}
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="flex items-center gap-1"
        >
          {(['all', 'pending', 'reviewed'] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors',
                filter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f === 'all' && `Todos (${logs.length})`}
              {f === 'pending' && `Pendentes (${pendingCount})`}
              {f === 'reviewed' && `Revisados (${logs.length - pendingCount})`}
            </button>
          ))}
        </motion.div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <Card className="p-16 flex flex-col items-center justify-center text-center gap-3">
              <ScanFace className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
              <p className="text-sm font-semibold">
                {filter === 'pending' ? 'Nenhum registro pendente' : 'Nenhum registro encontrado'}
              </p>
              <p className="text-xs text-muted-foreground">
                {filter === 'pending'
                  ? 'Todos os rostos foram revisados.'
                  : 'Nenhum rosto não identificado foi registrado.'}
              </p>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Ver todos os registros
                </button>
              )}
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          >
            {filtered.map((log) => (
              <Card
                key={log.id}
                className={cn(
                  'group overflow-hidden transition-all duration-200',
                  log.reviewed && 'opacity-50 hover:opacity-70'
                )}
              >
                {/* Photo */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={log.photoUrl}
                    alt="Rosto não identificado"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' fill='%232C2C2E'><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='64' fill='%23636366'>?</text></svg>`;
                    }}
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => { setSelectedLog(log); setLightboxOpen(true); }}
                      className="h-8 w-8 flex items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedLog(log); setDetailOpen(true); }}
                      className="h-8 w-8 flex items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Status badge */}
                  {log.reviewed && (
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-foreground/80 backdrop-blur-sm px-1.5 py-0.5 text-background text-[10px] font-medium">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Revisado
                      </span>
                    </div>
                  )}

                  {/* Confidence */}
                  {log.confidenceScore !== null && (
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center rounded-md bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-white text-[10px] font-medium">
                        {formatConfidence(log.confidenceScore)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {log.device.type === 'TABLET'
                      ? <Tablet className="h-3 w-3 text-muted-foreground shrink-0" />
                      : <Camera className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <span className="text-[11px] font-medium truncate">{log.device.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(log.timestamp)}</span>
                  </div>
                  {!log.reviewed && (
                    <button
                      onClick={() => markReviewed(log)}
                      disabled={markingId === log.id}
                      className="w-full mt-1 flex items-center justify-center gap-1.5 h-7 rounded-md border border-border text-[11px] font-medium hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Revisar
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </motion.div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle>Detalhe do Registro</DialogTitle>
                <DialogDescription>
                  Capturado em {formatDateTime(selectedLog.timestamp)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div
                  className="aspect-square rounded-md overflow-hidden bg-muted cursor-zoom-in"
                  onClick={() => { setDetailOpen(false); setLightboxOpen(true); }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedLog.photoUrl} alt="Rosto" className="w-full h-full object-cover" />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Dispositivo</span>
                    <span className="text-xs font-medium">{selectedLog.device.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Horário</span>
                    <span className="text-xs font-medium">{formatDateTime(selectedLog.timestamp)}</span>
                  </div>
                  {selectedLog.confidenceScore !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-xs">Confiança</span>
                      <span className="text-xs font-medium">{formatConfidence(selectedLog.confidenceScore)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Status</span>
                    <span className={cn('text-xs font-medium', selectedLog.reviewed ? 'text-foreground' : 'text-muted-foreground')}>
                      {selectedLog.reviewed ? 'Revisado' : 'Pendente'}
                    </span>
                  </div>
                  {selectedLog.reviewedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-xs">Revisado em</span>
                      <span className="text-xs font-medium">{formatDateTime(selectedLog.reviewedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
                {!selectedLog.reviewed && (
                  <Button onClick={() => { markReviewed(selectedLog); setDetailOpen(false); }} loading={markingId === selectedLog.id}>
                    <CheckCircle2 className="h-4 w-4" /> Revisar
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="sm:max-w-2xl p-2 bg-black/95 border-border/20">
          {selectedLog && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedLog.photoUrl} alt="Rosto ampliado" className="w-full rounded-md object-contain max-h-[80vh]" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                {selectedLog.confidenceScore !== null && (
                  <span className="inline-flex items-center rounded-md bg-black/70 backdrop-blur-sm px-2.5 py-1 text-white text-xs font-medium">
                    {formatConfidence(selectedLog.confidenceScore)}
                  </span>
                )}
                <span className="inline-flex items-center rounded-md bg-black/70 backdrop-blur-sm px-2.5 py-1 text-white text-xs">
                  {formatDateTime(selectedLog.timestamp)} · {selectedLog.device.name}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
