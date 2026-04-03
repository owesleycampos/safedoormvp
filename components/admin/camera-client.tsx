'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Video, VideoOff, Loader2, CheckCircle2, AlertCircle, Users, Clock } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

// AWS Rekognition free tier: 5,000 images/month.
// SearchFacesByImage = 1 API call per frame (detect + identify in one step).
// 2s interval = up to 2,592,000 calls/month on free tier — well within limit.
const SCAN_INTERVAL_MS = 2_000;
const CLIENT_COOLDOWN_MS = 60_000;
const MAX_RECENT = 5;

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [detectedFaces, setDetectedFaces] = useState<FaceMatch[]>([]);
  const [recentRecognitions, setRecentRecognitions] = useState<RecentRecognition[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [rekognitionConfigured, setRekognitionConfigured] = useState<boolean | null>(null); // null = checking

  // Keep mode ref in sync
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Check AWS Rekognition configuration on mount
  useEffect(() => {
    fetch('/api/camera/recognize')
      .then((r) => setRekognitionConfigured(r.ok || r.status !== 503))
      .catch(() => setRekognitionConfigured(false));
  }, []);

  // ── Register attendance (fire-and-forget) ──────────────────────────────────
  const registerAttendance = useCallback((match: FaceMatch) => {
    const currentMode = modeRef.current;
    fetch('/api/attendance/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: match.studentId,
        type: currentMode,
        confidence: match.confidence,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (data.skipped) {
          // "Entrada já registrada hoje" — show in recent list as already-registered
          if (data.reason && data.reason !== 'cooldown') {
            setRecentRecognitions((prev) => {
              // Avoid duplicate entries for same student
              if (prev.some((e) => e.studentId === match.studentId)) return prev;
              return [
                {
                  id: crypto.randomUUID(),
                  studentId: match.studentId!,
                  name: match.name,
                  photoUrl: match.photoUrl,
                  type: currentMode,
                  timestamp: new Date(),
                  confidence: match.confidence,
                },
                ...prev,
              ].slice(0, MAX_RECENT);
            });
          }
          return;
        }
        if (data.success) {
          const label = currentMode === 'ENTRY' ? 'Entrada registrada!' : 'Saída registrada!';
          toast({ variant: 'success', title: label, description: match.name });

          setRecentRecognitions((prev) =>
            [
              {
                id: data.event?.id ?? crypto.randomUUID(),
                studentId: match.studentId!,
                name: match.name,
                photoUrl: match.photoUrl,
                type: currentMode,
                timestamp: new Date(),
                confidence: match.confidence,
              },
              ...prev,
            ].slice(0, MAX_RECENT)
          );
        } else if (data.error) {
          console.error('[attendance] server error:', data.error, 'status:', r.status);
          toast({ variant: 'destructive', title: 'Erro ao registrar', description: data.error });
        }
      })
      .catch((err) => console.error('[attendance] error:', err));
  }, []);

  // ── Capture frame and send to Azure via server ────────────────────────────
  const scanFrame = useCallback(async () => {
    if (scanningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    scanningRef.current = true;
    setIsScanning(true);

    try {
      // Draw current video frame onto the hidden canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      // Encode as JPEG (quality 0.85 — good balance of size vs. accuracy)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob) return;

      const formData = new FormData();
      formData.append('image', blob, 'frame.jpg');

      const res = await fetch('/api/camera/recognize', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 503) setRekognitionConfigured(false);
        return;
      }

      const data = await res.json();
      const matches: FaceMatch[] = data.matches ?? [];
      setDetectedFaces(matches);

      // Register attendance for known students (with cooldown)
      for (const match of matches) {
        if (!match.studentId) continue;
        const cooldownKey = `${match.studentId}:${modeRef.current}`;
        const lastTime = cooldownRef.current.get(cooldownKey) ?? 0;
        const now = Date.now();
        if (now - lastTime > CLIENT_COOLDOWN_MS) {
          cooldownRef.current.set(cooldownKey, now);
          registerAttendance(match);
        }
      }
    } catch (err) {
      console.error('[scan] error:', err);
    } finally {
      scanningRef.current = false;
      setIsScanning(false);
    }
  }, [registerAttendance]);

  // ── Camera controls ───────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus('active');
    } catch (err: any) {
      console.error('[camera] error:', err);
      setCameraStatus('error');
      toast({ variant: 'destructive', title: 'Erro na câmera', description: err.message });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraStatus('idle');
    setDetectedFaces([]);
  }, []);

  // ── Start/stop scan loop when camera becomes active ───────────────────────
  useEffect(() => {
    if (cameraStatus === 'active') {
      // Short delay to let the video stabilize before first scan
      const timeout = setTimeout(() => {
        scanFrame();
        intervalRef.current = setInterval(scanFrame, SCAN_INTERVAL_MS);
      }, 600);

      return () => {
        clearTimeout(timeout);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [cameraStatus, scanFrame]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isLoading = rekognitionConfigured === null;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* Header — compact on mobile */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b border-border flex-shrink-0">
        {/* Title hidden on mobile to save space */}
        <div className="hidden md:block">
          <h1 className="text-base font-semibold">Câmera ao Vivo</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reconhecimento facial via AWS Rekognition
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-secondary/40">
            <button
              onClick={() => setMode('ENTRY')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                mode === 'ENTRY' ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              ENTRADA
            </button>
            <button
              onClick={() => setMode('EXIT')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                mode === 'EXIT' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              SAÍDA
            </button>
          </div>

          {/* Camera toggle */}
          {cameraStatus === 'idle' || cameraStatus === 'error' ? (
            <Button
              size="sm"
              onClick={startCamera}
              disabled={isLoading || rekognitionConfigured === false}
              className="gap-1.5"
            >
              <Video className="h-3.5 w-3.5" />
              Iniciar Câmera
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={stopCamera} className="gap-1.5">
              <VideoOff className="h-3.5 w-3.5" />
              Parar
            </Button>
          )}
        </div>
      </div>

      {/* Main content — mobile: stacked column, desktop: side by side */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Camera + overlays — aspect-video on mobile, fills remaining space on desktop */}
        <div className="relative bg-black overflow-hidden w-full aspect-video md:aspect-auto md:flex-1">

          {/* AWS Rekognition not configured */}
          {rekognitionConfigured === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20 px-8">
              <AlertCircle className="h-10 w-10 text-yellow-400" />
              <div className="text-center">
                <p className="text-white text-sm font-semibold">AWS Rekognition não configurado</p>
                <p className="text-white/60 text-xs mt-2 leading-relaxed">
                  Adicione as variáveis de ambiente no Vercel:<br />
                  <code className="text-yellow-400">AWS_ACCESS_KEY_ID</code> e <code className="text-yellow-400">AWS_SECRET_ACCESS_KEY</code>
                </p>
              </div>
            </div>
          )}

          {/* Checking config */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
              <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
            </div>
          )}

          {/* Idle state */}
          {cameraStatus === 'idle' && rekognitionConfigured && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 z-10">
              <Video className="h-16 w-16 text-white/30" strokeWidth={1} />
              <div className="text-center">
                <p className="text-white text-sm font-medium">Câmera inativa</p>
                <p className="text-white/60 text-xs mt-1">Clique em &quot;Iniciar Câmera&quot; para começar</p>
              </div>
            </div>
          )}

          {/* Starting */}
          {cameraStatus === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}

          {/* Camera error */}
          {cameraStatus === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-10">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-white text-sm">Não foi possível acessar a câmera.</p>
              <p className="text-white/60 text-xs">Verifique as permissões do navegador.</p>
            </div>
          )}

          {/* Video element */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />

          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Face bounding boxes + name cards */}
          {cameraStatus === 'active' && detectedFaces.length > 0 && videoRef.current && (
            <div className="absolute inset-0 pointer-events-none">
              {detectedFaces.map((face, idx) => {
                const video = videoRef.current!;
                const isKnown = face.studentId !== null;
                const box = face.box; // AWS: fractions 0–1; null if unavailable

                // Convert fraction-based box to display pixels
                const boxPx = box ? {
                  left: box.left * video.clientWidth,
                  top: box.top * video.clientHeight,
                  width: box.width * video.clientWidth,
                  height: box.height * video.clientHeight,
                } : null;

                return (
                  <div key={idx}>
                    {/* Bounding box — only if position is available */}
                    {boxPx && (
                    <div
                      className={cn(
                        'absolute border-2 rounded-md transition-all',
                        isKnown ? 'border-emerald-400' : 'border-red-400'
                      )}
                      style={{
                        left: boxPx.left,
                        top: boxPx.top,
                        width: boxPx.width,
                        height: boxPx.height,
                      }}
                    />
                    )}

                    {/* Name card */}
                    <div
                      className={cn(
                        'absolute flex items-center gap-2 rounded-lg px-2.5 py-1.5 shadow-lg',
                        isKnown ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
                      )}
                      style={{
                        left: boxPx ? boxPx.left : 16,
                        top: boxPx ? Math.max(0, boxPx.top - 40) : 16,
                        maxWidth: 240,
                      }}
                    >
                      {face.photoUrl && isKnown && (
                        <img
                          src={face.photoUrl}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover border border-white/30 flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate leading-tight">{face.name}</p>
                        {isKnown && (
                          <p className="text-[10px] text-white/80 leading-tight">
                            {Math.round(face.confidence * 100)}% confiança
                            {face.className ? ` · ${face.className}` : ''}
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
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isScanning ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'
                )}
              />
              <span className="text-white text-[10px]">
                {isScanning ? 'Analisando...' : 'Monitorando'}
              </span>
            </div>
          )}

          {/* Mode badge */}
          {cameraStatus === 'active' && (
            <div className="absolute top-3 left-3">
              <span
                className={cn(
                  'text-xs font-bold px-2.5 py-1 rounded-full',
                  mode === 'ENTRY' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'
                )}
              >
                MODO {mode === 'ENTRY' ? 'ENTRADA' : 'SAÍDA'}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar — full width below camera on mobile, fixed sidebar on desktop */}
        <div className="w-full md:w-72 flex flex-col border-t md:border-t-0 md:border-l border-border bg-card overflow-hidden flex-shrink-0 md:overflow-y-auto">

          {/* Status */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Status</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">AWS Rekognition</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5',
                    isLoading ? 'text-muted-foreground' :
                    rekognitionConfigured ? 'text-emerald-500 border-emerald-500/30' :
                    'text-destructive border-destructive/30'
                  )}
                >
                  {isLoading ? 'Verificando' : rekognitionConfigured ? 'Configurado' : 'Não configurado'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Câmera</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5',
                    cameraStatus === 'active' ? 'text-emerald-500 border-emerald-500/30' :
                    cameraStatus === 'error' ? 'text-destructive border-destructive/30' :
                    'text-muted-foreground'
                  )}
                >
                  {cameraStatus === 'active' ? 'Ativa' :
                   cameraStatus === 'starting' ? 'Iniciando' :
                   cameraStatus === 'error' ? 'Erro' : 'Inativa'}
                </Badge>
              </div>
              {detectedFaces.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Rostos detectados</span>
                  <span className="text-xs font-medium">{detectedFaces.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent recognitions */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Reconhecimentos Recentes
            </p>

            {recentRecognitions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Users className="h-8 w-8 text-muted-foreground/30" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground text-center">
                  Nenhum reconhecimento ainda.<br />Inicie a câmera para começar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRecognitions.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-2.5 rounded-lg border border-border p-2.5"
                  >
                    {rec.photoUrl ? (
                      <img
                        src={rec.photoUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{rec.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                          rec.type === 'ENTRY'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-orange-500/10 text-orange-600'
                        )}>
                          {rec.type === 'ENTRY' ? 'Entrada' : 'Saída'}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {rec.timestamp.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
