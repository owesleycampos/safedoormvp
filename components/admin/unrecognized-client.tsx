'use client';

import { useState } from 'react';
import {
  CheckCircle2, Filter, AlertTriangle, Eye, X, ScanFace,
  Clock, Tablet, Camera, ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { cn, formatDateTime, formatRelativeTime, formatConfidence } from '@/lib/utils';

interface LogDevice {
  id: string;
  name: string;
  type: string;
}

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

interface UnrecognizedClientProps {
  logs: LogItem[];
}

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

  const pendingCount = logs.filter((l) => !l.reviewed).length;

  function openDetail(log: LogItem) {
    setSelectedLog(log);
    setDetailOpen(true);
  }

  function openLightbox(log: LogItem) {
    setSelectedLog(log);
    setLightboxOpen(true);
  }

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
      setLogs((prev) =>
        prev.map((l) =>
          l.id === log.id ? { ...l, reviewed: true, reviewedAt: new Date().toISOString() } : l
        )
      );
      if (selectedLog?.id === log.id) {
        setSelectedLog((prev) => prev ? { ...prev, reviewed: true, reviewedAt: new Date().toISOString() } : null);
      }
      toast({ variant: 'success', title: 'Marcado como revisado' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllReviewed() {
    const pendingLogs = logs.filter((l) => !l.reviewed);
    if (pendingLogs.length === 0) return;
    if (!confirm(`Marcar todos os ${pendingLogs.length} registros pendentes como revisados?`)) return;

    setMarkingAll(true);
    try {
      const res = await fetch('/api/unrecognized/review-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingLogs.map((l) => l.id) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reviewedAt = new Date().toISOString();
      setLogs((prev) =>
        prev.map((l) =>
          !l.reviewed ? { ...l, reviewed: true, reviewedAt } : l
        )
      );
      toast({
        variant: 'success',
        title: 'Todos revisados',
        description: `${pendingLogs.length} registro${pendingLogs.length !== 1 ? 's' : ''} marcado${pendingLogs.length !== 1 ? 's' : ''} como revisado${pendingLogs.length !== 1 ? 's' : ''}.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setMarkingAll(false);
    }
  }

  function getConfidenceVariant(score: number | null) {
    if (score === null) return 'outline';
    if (score >= 0.8) return 'destructive'; // High confidence it's a real unknown
    if (score >= 0.5) return 'warning';
    return 'success'; // Low confidence — likely false positive
  }

  return (
    <div className="space-y-6">
      {/* Stats + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div className="flex rounded-md overflow-hidden border border-border/50">
            {(['all', 'pending', 'reviewed'] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5',
                  filter === f
                    ? 'bg-primary text-white'
                    : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                )}
              >
                {f === 'all' && `Todos (${logs.length})`}
                {f === 'pending' && (
                  <>
                    <span className={cn('h-2 w-2 rounded-full', pendingCount > 0 ? 'bg-danger' : 'bg-muted-foreground')} />
                    Pendentes ({pendingCount})
                  </>
                )}
                {f === 'reviewed' && `Revisados (${logs.length - pendingCount})`}
              </button>
            ))}
          </div>
        </div>

        {pendingCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllReviewed}
            loading={markingAll}
          >
            <CheckCircle2 className="h-4 w-4" />
            Marcar todos como revisados
          </Button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center">
            <ScanFace className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-lg">
              {filter === 'pending' ? 'Nenhum registro pendente' : 'Nenhum registro encontrado'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'pending'
                ? 'Todos os rostos foram revisados.'
                : 'Nenhum rosto não identificado foi registrado ainda.'}
            </p>
          </div>
          {filter !== 'all' && (
            <Button variant="outline" onClick={() => setFilter('all')}>
              Ver todos os registros
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((log) => (
            <Card
              key={log.id}
              className={cn(
                'group overflow-hidden transition-all duration-200',
                log.reviewed
                  ? 'opacity-60 hover:opacity-80'
                  : 'hover:border-destructive/40 hover:'
              )}
            >
              {/* Photo */}
              <div className="relative aspect-square bg-secondary overflow-hidden">
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

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    className="rounded-md"
                    onClick={() => openLightbox(log)}
                    title="Ampliar foto"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    className="rounded-md"
                    onClick={() => openDetail(log)}
                    title="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>

                {/* Reviewed badge */}
                {log.reviewed && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-success/90 backdrop-blur-sm px-2 py-0.5 text-white text-xs font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      Revisado
                    </span>
                  </div>
                )}

                {/* Confidence badge */}
                {log.confidenceScore !== null && (
                  <div className="absolute top-2 left-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold backdrop-blur-sm',
                        log.confidenceScore >= 0.8
                          ? 'bg-destructive text-white'
                          : log.confidenceScore >= 0.5
                          ? 'bg-warn text-gray-900'
                          : 'bg-success/90 text-white'
                      )}
                    >
                      {formatConfidence(log.confidenceScore)}
                    </span>
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-4 space-y-2.5">
                {/* Device */}
                <div className="flex items-center gap-1.5">
                  {log.device.type === 'TABLET'
                    ? <Tablet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <Camera className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  }
                  <span className="text-xs font-medium truncate">{log.device.name}</span>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>

                {/* Mark reviewed button */}
                {!log.reviewed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1"
                    onClick={() => markReviewed(log)}
                    loading={markingId === log.id}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar como revisado
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle>Detalhe do Registro</DialogTitle>
                <DialogDescription>
                  Rosto não identificado capturado em {formatDateTime(selectedLog.timestamp)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Photo */}
                <div
                  className="aspect-square rounded-md overflow-hidden bg-secondary cursor-zoom-in"
                  onClick={() => { setDetailOpen(false); setLightboxOpen(true); }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedLog.photoUrl}
                    alt="Rosto"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info rows */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Dispositivo</span>
                    <span className="font-medium">{selectedLog.device.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Horário</span>
                    <span className="font-medium">{formatDateTime(selectedLog.timestamp)}</span>
                  </div>
                  {selectedLog.confidenceScore !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Confiança do sistema</span>
                      <Badge variant={getConfidenceVariant(selectedLog.confidenceScore)}>
                        {formatConfidence(selectedLog.confidenceScore)}
                      </Badge>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    {selectedLog.reviewed ? (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Revisado
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </div>
                  {selectedLog.reviewedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Revisado em</span>
                      <span className="font-medium text-xs">{formatDateTime(selectedLog.reviewedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
                {!selectedLog.reviewed && (
                  <Button
                    onClick={() => { markReviewed(selectedLog); setDetailOpen(false); }}
                    loading={markingId === selectedLog.id}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar como revisado
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="sm:max-w-2xl p-2 bg-black/90 border-border/20">
          {selectedLog && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedLog.photoUrl}
                alt="Rosto ampliado"
                className="w-full rounded-md object-contain max-h-[80vh]"
              />
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                {selectedLog.confidenceScore !== null && (
                  <span className="inline-flex items-center rounded-lg bg-black/70 backdrop-blur-sm px-3 py-1 text-white text-sm font-medium">
                    Confiança: {formatConfidence(selectedLog.confidenceScore)}
                  </span>
                )}
                <span className="inline-flex items-center rounded-lg bg-black/70 backdrop-blur-sm px-3 py-1 text-white text-sm">
                  {formatDateTime(selectedLog.timestamp)} • {selectedLog.device.name}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
