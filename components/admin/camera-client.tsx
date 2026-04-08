'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Video, VideoOff, Loader2, CheckCircle2, AlertCircle, Users, Clock,
  LogIn, LogOut, List, X,
} from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FaceMatch {
  studentId: string | null;
  name: string;
  photoUrl: string | null;
  className: string | null;
  confidence: number;
  box: { top: number; left: number; width: number; height: number };
}

interface RecentRecognition {
  id: string;
  studentId: string;
  name: string;
  photoUrl: string | null;
  type: 'ENTRY' | 'EXIT';
  timestamp: Date;
  confidence: number;
}

const SCAN_INTERVAL_MS = 2_000;
const CLIENT_COOLDOWN_MS = 60_000;
const MAX_RECENT = 10;

export function CameraClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const scanningRef = useRef(false);
  const modeRef = useRef<'ENTRY' | 'EXIT'>('ENTRY');

  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [mode, setMode] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [modeChosen, setModeChosen] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<FaceMatch[]>([]);
  const [recentRecognitions, setRecentRecognitions] = useState<RecentRecognition[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [rekognitionConfigured, setRekognitionConfigured] = useState<boolean | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    fetch('/api/camera/recognize')
      .then((r) => setRekognitionConfigured(r.ok || r.status !== 503))
      .catch(() => setRekognitionConfigured(false));
  }, []);

  const registerAttendance = useCallback((match: FaceMatch) => {
    const currentMode = modeRef.current;
    fetch('/api/attendance/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: match.studentId, type: currentMode, confidence: match.confidence }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (data.skipped) {
          if (data.reason && data.reason !== 'cooldown') {
            setRecentRecognitions((prev) => {
              if (prev.some((e) => e.studentId === match.studentId)) return prev;
              return [{ id: crypto.randomUUID(), studentId: match.studentId!, name: match.name, photoUrl: match.photoUrl, type: currentMode, timestamp: new Date(), confidence: match.confidence }, ...prev].slice(0, MAX_RECENT);
            });
          }
          return;
        }
        if (data.success) {
          const label = currentMode === 'ENTRY' ? 'Entrada registrada!' : 'Saída registrada!';
          toast({ variant: 'success', title: label, description: match.name });
          setRecentRecognitions((prev) =>
            [{ id: data.event?.id ?? crypto.randomUUID(), studentId: match.studentId!, name: match.name, photoUrl: match.photoUrl, type: currentMode, timestamp: new Date(), confidence: match.confidence }, ...prev].slice(0, MAX_RECENT)
          );
        } else if (data.error) {
          toast({ variant: 'destructive', title: 'Erro ao registrar', description: data.error });
        }
      })
      .catch((err) => console.error('[attendance] error:', err));
  }, []);

  const scanFrame = useCallback(async () => {
    if (scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    scanningRef.current = true;
    setIsScanning(true);

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) return;

      const formData = new FormData();
      formData.append('image', blob, 'frame.jpg');

      const res = await fetch('/api/camera/recognize', { method: 'POST', body: formData });
      if (!res.ok) { if (res.status === 503) setRekognitionConfigured(false); return; }

      const data = await res.json();
      const matches: FaceMatch[] = data.matches ?? [];
      setDetectedFaces(matches);

      for (const match of matches) {
        if (!match.studentId) continue;
        const cooldownKey = `${match.studentId}:${modeRef.current}`;
        const lastTime = cooldownRef.current.get(cooldownKey) ?? 0;
        if (Date.now() - lastTime > CLIENT_COOLDOWN_MS) {
          cooldownRef.current.set(cooldownKey, Date.now());
          registerAttendance(match);
        }
      }
    } catch (err) { console.error('[scan] error:', err); }
    finally { scanningRef.current = false; setIsScanning(false); }
  }, [registerAttendance]);

  const startCamera = useCallback(async () => {
    setCameraStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraStatus('active');
    } catch (err: any) {
      setCameraStatus('error');
      toast({ variant: 'destructive', title: 'Erro na câmera', description: err.message });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraStatus('idle');
    setModeChosen(false);
    setDetectedFaces([]);
  }, []);

  useEffect(() => {
    if (cameraStatus === 'active') {
      const timeout = setTimeout(() => {
        scanFrame();
        intervalRef.current = setInterval(scanFrame, SCAN_INTERVAL_MS);
      }, 600);
      return () => { clearTimeout(timeout); if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
  }, [cameraStatus, scanFrame]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const isLoading = rekognitionConfigured === null;

  // Mode pre-selection — monochrome
  if (!modeChosen) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 bg-background px-6 gap-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight">Câmera ao Vivo</h2>
          <p className="text-sm text-muted-foreground mt-1">Selecione o modo antes de iniciar</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-sm">
          <button
            onClick={() => { setMode('ENTRY'); setModeChosen(true); }}
            className="flex-1 flex flex-col items-center gap-3 rounded-lg border border-border hover:bg-accent active:scale-[0.98] transition-all p-6"
          >
            <LogIn className="h-8 w-8 text-foreground" strokeWidth={1.5} />
            <span className="text-sm font-semibold">ENTRADA</span>
            <span className="text-[11px] text-muted-foreground text-center">Registrar chegada dos alunos</span>
          </button>

          <button
            onClick={() => { setMode('EXIT'); setModeChosen(true); }}
            className="flex-1 flex flex-col items-center gap-3 rounded-lg border border-border hover:bg-accent active:scale-[0.98] transition-all p-6"
          >
            <LogOut className="h-8 w-8 text-foreground" strokeWidth={1.5} />
            <span className="text-sm font-semibold">SAÍDA</span>
            <span className="text-[11px] text-muted-foreground text-center">Registrar saída dos alunos</span>
          </button>
        </div>

        {rekognitionConfigured === false && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md px-4 py-3 max-w-sm text-center">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            AWS Rekognition não configurado. Verifique as variáveis de ambiente.
          </div>
        )}
      </div>
    );
  }

  // Camera active view
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b border-border flex-shrink-0">
        <div className="hidden md:block">
          <h1 className="text-sm font-semibold">Câmera ao Vivo</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">AWS Rekognition</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Mode toggle — monochrome */}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setMode('ENTRY')}
              className={cn(
                'px-3 py-1 rounded text-[11px] font-medium transition-colors',
                mode === 'ENTRY' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              ENTRADA
            </button>
            <button
              onClick={() => setMode('EXIT')}
              className={cn(
                'px-3 py-1 rounded text-[11px] font-medium transition-colors',
                mode === 'EXIT' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              SAÍDA
            </button>
          </div>

          {cameraStatus === 'idle' || cameraStatus === 'error' ? (
            <Button size="sm" onClick={startCamera} disabled={isLoading || rekognitionConfigured === false} className="gap-1.5">
              <Video className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Iniciar Câmera</span>
              <span className="sm:hidden">Iniciar</span>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={stopCamera} className="gap-1.5">
              <VideoOff className="h-3.5 w-3.5" /> Parar
            </Button>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Camera area */}
        <div className="relative bg-black overflow-hidden flex-1">

          {rekognitionConfigured === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20 px-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-white text-sm font-medium">AWS Rekognition não configurado</p>
                <p className="text-white/50 text-xs mt-2 leading-relaxed">
                  Adicione <code className="text-white/70">AWS_ACCESS_KEY_ID</code> e{' '}
                  <code className="text-white/70">AWS_SECRET_ACCESS_KEY</code>
                </p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
              <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
            </div>
          )}

          {cameraStatus === 'idle' && rekognitionConfigured && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 z-10">
              <Video className="h-12 w-12 text-white/20" strokeWidth={1} />
              <div className="text-center">
                <p className="text-white/80 text-sm font-medium">Câmera inativa</p>
                <p className="text-white/40 text-xs mt-1">Clique em &quot;Iniciar Câmera&quot;</p>
              </div>
            </div>
          )}

          {cameraStatus === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}

          {cameraStatus === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-10">
              <AlertCircle className="h-6 w-6 text-white/60" />
              <p className="text-white/80 text-sm">Não foi possível acessar a câmera.</p>
              <p className="text-white/40 text-xs">Verifique as permissões do navegador.</p>
            </div>
          )}

          <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          {/* Bounding boxes */}
          {cameraStatus === 'active' && detectedFaces.length > 0 && videoRef.current && (
            <div className="absolute inset-0 pointer-events-none">
              {detectedFaces.map((face, idx) => {
                const video = videoRef.current!;
                const isKnown = face.studentId !== null;
                const box = face.box;
                const boxPx = box ? {
                  left: box.left * video.clientWidth, top: box.top * video.clientHeight,
                  width: box.width * video.clientWidth, height: box.height * video.clientHeight,
                } : null;

                return (
                  <div key={idx}>
                    {boxPx && (
                      <div
                        className={cn('absolute border-2 rounded-sm transition-all', isKnown ? 'border-white' : 'border-white/40')}
                        style={{ left: boxPx.left, top: boxPx.top, width: boxPx.width, height: boxPx.height }}
                      />
                    )}
                    <div
                      className="absolute flex items-center gap-2 rounded-md px-2.5 py-1.5 shadow-lg bg-black/70 backdrop-blur-sm text-white"
                      style={{ left: boxPx ? boxPx.left : 16, top: boxPx ? Math.max(0, boxPx.top - 40) : 16, maxWidth: 240 }}
                    >
                      {face.photoUrl && isKnown && (
                        <img src={face.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover border border-white/20 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate leading-tight">{face.name}</p>
                        {isKnown && (
                          <p className="text-[10px] text-white/60 leading-tight">
                            {Math.round(face.confidence * 100)}%{face.className ? ` · ${face.className}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Scanning indicator */}
          {cameraStatus === 'active' && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-2.5 py-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', isScanning ? 'bg-white/60 animate-pulse' : 'bg-white')} />
              <span className="text-white text-[10px]">{isScanning ? 'Analisando...' : 'Monitorando'}</span>
            </div>
          )}

          {/* Mode badge */}
          {cameraStatus === 'active' && (
            <div className="absolute top-3 left-3">
              <span className="text-[10px] font-semibold px-2 py-1 rounded-md bg-foreground text-background">
                {mode === 'ENTRY' ? 'ENTRADA' : 'SAÍDA'}
              </span>
            </div>
          )}

          {/* Mobile panel toggle */}
          <button
            onClick={() => setPanelOpen(true)}
            className="md:hidden absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 text-white text-[11px] font-medium"
          >
            <List className="h-3.5 w-3.5" />
            {recentRecognitions.length > 0 && <span className="tabular-nums">{recentRecognitions.length}</span>}
          </button>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex w-72 flex-col border-l border-border bg-card overflow-hidden flex-shrink-0">
          <SidebarContent
            rekognitionConfigured={rekognitionConfigured}
            isLoading={isLoading}
            cameraStatus={cameraStatus}
            detectedFaces={detectedFaces}
            recentRecognitions={recentRecognitions}
          />
        </div>
      </div>

      {/* Mobile panel */}
      {panelOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPanelOpen(false)} />
          <div className="relative bg-card rounded-t-lg max-h-[70vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <p className="text-sm font-semibold">Reconhecimentos Recentes</p>
              <button onClick={() => setPanelOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <RecentList recentRecognitions={recentRecognitions} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  rekognitionConfigured, isLoading, cameraStatus, detectedFaces, recentRecognitions,
}: {
  rekognitionConfigured: boolean | null; isLoading: boolean; cameraStatus: string;
  detectedFaces: FaceMatch[]; recentRecognitions: RecentRecognition[];
}) {
  return (
    <>
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Status</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">AWS Rekognition</span>
            <span className={cn('text-[10px] font-medium',
              isLoading ? 'text-muted-foreground' : rekognitionConfigured ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {isLoading ? 'Verificando...' : rekognitionConfigured ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Câmera</span>
            <span className={cn('text-[10px] font-medium',
              cameraStatus === 'active' ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {cameraStatus === 'active' ? 'Ativa' : cameraStatus === 'starting' ? 'Iniciando' : cameraStatus === 'error' ? 'Erro' : 'Inativa'}
            </span>
          </div>
          {detectedFaces.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Rostos detectados</span>
              <span className="text-[10px] font-medium tabular-nums">{detectedFaces.length}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Reconhecimentos Recentes</p>
        <RecentList recentRecognitions={recentRecognitions} />
      </div>
    </>
  );
}

function RecentList({ recentRecognitions }: { recentRecognitions: RecentRecognition[] }) {
  if (recentRecognitions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Users className="h-6 w-6 text-muted-foreground/30" strokeWidth={1.5} />
        <p className="text-[11px] text-muted-foreground text-center">
          Nenhum reconhecimento ainda.<br />Inicie a câmera para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {recentRecognitions.map((rec) => (
        <div key={rec.id} className="flex items-center gap-2.5 rounded-md border border-border p-2.5">
          {rec.photoUrl ? (
            <img src={rec.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium truncate">{rec.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">
                {rec.type === 'ENTRY' ? 'Entrada' : 'Saída'}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {rec.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
          <CheckCircle2 className="h-3.5 w-3.5 text-foreground/40 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
