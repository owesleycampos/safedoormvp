'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Video, VideoOff, Loader2, CheckCircle2, AlertCircle, Users, Clock } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StudentDescriptor {
  id: string;
  name: string;
  photoUrl: string | null;
  descriptor: number[] | null;
  classId: string;
  className: string | null;
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

interface DetectedFace {
  studentId: string | null;
  name: string;
  photoUrl: string | null;
  confidence: number; // 0–1 (1 = perfect match, lower = worse)
  distance: number;   // face-api distance (lower = better)
  box: { x: number; y: number; width: number; height: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MATCH_THRESHOLD = 0.5;   // face-api distance threshold
const SCAN_INTERVAL_MS = 800;
const CLIENT_COOLDOWN_MS = 60_000;
const MAX_RECENT = 5;
const MODELS_PATH = '/models';

// ── Helpers ───────────────────────────────────────────────────────────────────

function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CameraClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceapiRef = useRef<any>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());

  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modelProgress, setModelProgress] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [mode, setMode] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [students, setStudents] = useState<StudentDescriptor[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [recentRecognitions, setRecentRecognitions] = useState<RecentRecognition[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // ── Load face-api.js models ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadModels() {
      try {
        setModelProgress(10);
        // Dynamic import to avoid SSR issues
        const faceapi = await import('@vladmandic/face-api');
        faceapiRef.current = faceapi;

        setModelProgress(20);
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH);
        setModelProgress(50);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_PATH);
        setModelProgress(75);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH);
        setModelProgress(100);

        setModelStatus('ready');
      } catch (err) {
        console.error('[face-api] Model load error:', err);
        setModelStatus('error');
      }
    }

    loadModels();
  }, []);

  // ── Load student descriptors ─────────────────────────────────────────────────
  useEffect(() => {
    async function fetchDescriptors() {
      try {
        const res = await fetch('/api/students/descriptors');
        if (!res.ok) return;
        const data = await res.json();
        const list: StudentDescriptor[] = data.students || [];
        setStudents(list);
        setEnrolledCount(list.filter((s) => s.descriptor !== null).length);
      } catch (err) {
        console.error('[descriptors] fetch error:', err);
      }
    }
    fetchDescriptors();
  }, []);

  // ── Start camera ─────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
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

  // ── Stop camera ──────────────────────────────────────────────────────────────
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

  // ── Face detection loop ──────────────────────────────────────────────────────
  const runDetection = useCallback(async () => {
    const faceapi = faceapiRef.current;
    if (!faceapi || !videoRef.current || videoRef.current.readyState < 2) return;
    if (isScanning) return;

    setIsScanning(true);
    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        setDetectedFaces([]);
        setIsScanning(false);
        return;
      }

      const enrolled = students.filter((s) => s.descriptor !== null);
      const newFaces: DetectedFace[] = [];

      for (const det of detections) {
        const detDescriptor = det.descriptor as Float32Array;
        const box = det.detection.box;

        if (enrolled.length === 0) {
          newFaces.push({
            studentId: null,
            name: 'Nenhum aluno cadastrado',
            photoUrl: null,
            confidence: 0,
            distance: 1,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
          });
          continue;
        }

        // Find closest match
        let bestDistance = Infinity;
        let bestStudent: StudentDescriptor | null = null;

        for (const student of enrolled) {
          const refDescriptor = new Float32Array(student.descriptor!);
          const dist = euclideanDistance(detDescriptor, refDescriptor);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestStudent = student;
          }
        }

        if (bestStudent && bestDistance < MATCH_THRESHOLD) {
          const confidence = Math.max(0, 1 - bestDistance / MATCH_THRESHOLD);
          newFaces.push({
            studentId: bestStudent.id,
            name: bestStudent.name,
            photoUrl: bestStudent.photoUrl,
            confidence,
            distance: bestDistance,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
          });

          // Register attendance with cooldown check
          const cooldownKey = `${bestStudent.id}:${mode}`;
          const lastTime = cooldownRef.current.get(cooldownKey) ?? 0;
          const now = Date.now();
          if (now - lastTime > CLIENT_COOLDOWN_MS) {
            cooldownRef.current.set(cooldownKey, now);
            registerAttendance(bestStudent, confidence);
          }
        } else {
          newFaces.push({
            studentId: null,
            name: 'Rosto não identificado',
            photoUrl: null,
            confidence: 0,
            distance: bestDistance,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
          });
        }
      }

      setDetectedFaces(newFaces);
    } catch (err) {
      console.error('[detection] error:', err);
    } finally {
      setIsScanning(false);
    }
  }, [students, mode, isScanning]);

  // ── Register attendance ──────────────────────────────────────────────────────
  const registerAttendance = useCallback(async (student: StudentDescriptor, confidence: number) => {
    try {
      const res = await fetch('/api/attendance/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, type: mode, confidence }),
      });
      const data = await res.json();

      if (data.skipped) return;

      if (data.success) {
        const label = mode === 'ENTRY' ? 'Entrada registrada!' : 'Saída registrada!';
        toast({ variant: 'success', title: label, description: student.name });

        const newRecognition: RecentRecognition = {
          id: data.event?.id ?? crypto.randomUUID(),
          studentId: student.id,
          name: student.name,
          photoUrl: student.photoUrl,
          type: mode,
          timestamp: new Date(),
          confidence,
        };

        setRecentRecognitions((prev) => [newRecognition, ...prev].slice(0, MAX_RECENT));
      }
    } catch (err) {
      console.error('[attendance] register error:', err);
    }
  }, [mode]);

  // ── Start/stop detection loop when camera is active ──────────────────────────
  useEffect(() => {
    if (cameraStatus === 'active' && modelStatus === 'ready') {
      intervalRef.current = setInterval(runDetection, SCAN_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cameraStatus, modelStatus, runDetection]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold">Câmera ao Vivo</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reconhecimento facial em tempo real · {enrolledCount} aluno{enrolledCount !== 1 ? 's' : ''} cadastrado{enrolledCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            <Button size="sm" onClick={startCamera} disabled={modelStatus !== 'ready'} className="gap-1.5">
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

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Camera + overlays */}
        <div className="flex-1 relative bg-black overflow-hidden">

          {/* Model loading */}
          {modelStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
              <div className="text-center">
                <p className="text-white text-sm font-medium">Carregando modelos de IA...</p>
                <p className="text-white/60 text-xs mt-1">{modelProgress}%</p>
              </div>
              <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
            </div>
          )}

          {modelStatus === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-20">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-white text-sm">Erro ao carregar modelos de IA.</p>
              <p className="text-white/60 text-xs">Verifique se os modelos estão em /public/models/</p>
            </div>
          )}

          {/* Idle state */}
          {cameraStatus === 'idle' && modelStatus === 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 z-10">
              <Video className="h-16 w-16 text-white/30" strokeWidth={1} />
              <div className="text-center">
                <p className="text-white text-sm font-medium">Câmera inativa</p>
                <p className="text-white/60 text-xs mt-1">Clique em "Iniciar Câmera" para começar</p>
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

          {/* Hidden canvas for processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Face detection overlays */}
          {cameraStatus === 'active' && detectedFaces.length > 0 && videoRef.current && (
            <div className="absolute inset-0 pointer-events-none">
              {detectedFaces.map((face, idx) => {
                const video = videoRef.current!;
                const scaleX = video.clientWidth / (video.videoWidth || video.clientWidth);
                const scaleY = video.clientHeight / (video.videoHeight || video.clientHeight);
                const isKnown = face.studentId !== null;

                return (
                  <div key={idx}>
                    {/* Bounding box */}
                    <div
                      className={cn(
                        'absolute border-2 rounded-md transition-all',
                        isKnown ? 'border-emerald-400' : 'border-red-400'
                      )}
                      style={{
                        left: face.box.x * scaleX,
                        top: face.box.y * scaleY,
                        width: face.box.width * scaleX,
                        height: face.box.height * scaleY,
                      }}
                    />

                    {/* Name card */}
                    <div
                      className={cn(
                        'absolute flex items-center gap-2 rounded-lg px-2.5 py-1.5 shadow-lg',
                        isKnown
                          ? 'bg-emerald-500/90 text-white'
                          : 'bg-red-500/90 text-white'
                      )}
                      style={{
                        left: face.box.x * scaleX,
                        top: Math.max(0, (face.box.y * scaleY) - 40),
                        maxWidth: 220,
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
              <span className={cn('h-1.5 w-1.5 rounded-full', isScanning ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400')} />
              <span className="text-white text-[10px]">{isScanning ? 'Analisando...' : 'Aguardando'}</span>
            </div>
          )}

          {/* Mode badge */}
          {cameraStatus === 'active' && (
            <div className="absolute top-3 left-3">
              <span className={cn(
                'text-xs font-bold px-2.5 py-1 rounded-full',
                mode === 'ENTRY' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'
              )}>
                MODO {mode === 'ENTRY' ? 'ENTRADA' : 'SAÍDA'}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 flex flex-col border-l border-border bg-card overflow-hidden flex-shrink-0">

          {/* Status */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Status</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Modelos IA</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5',
                    modelStatus === 'ready' ? 'text-emerald-500 border-emerald-500/30' :
                    modelStatus === 'error' ? 'text-destructive border-destructive/30' :
                    'text-yellow-500 border-yellow-500/30'
                  )}
                >
                  {modelStatus === 'ready' ? 'Prontos' : modelStatus === 'loading' ? 'Carregando' : 'Erro'}
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
                  {cameraStatus === 'active' ? 'Ativa' : cameraStatus === 'starting' ? 'Iniciando' : cameraStatus === 'error' ? 'Erro' : 'Inativa'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Alunos cadastrados</span>
                <span className="text-xs font-medium">{enrolledCount}</span>
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
                          rec.type === 'ENTRY' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600'
                        )}>
                          {rec.type === 'ENTRY' ? 'Entrada' : 'Saída'}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {rec.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
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
