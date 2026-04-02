'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, X, Star, StarOff, Plus, Search, UserPlus, Trash2,
  Phone, Mail, MessageCircle, ChevronRight, Loader2,
  Cpu, CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { getInitials, cn } from '@/lib/utils';

interface StudentPhoto {
  id: string;
  url: string;
  isProfile: boolean;
  label?: string | null;
}

interface ParentLink {
  parentId: string;
  relationship: string;
  isPrimary: boolean;
  parent: {
    id: string;
    name: string;
    phone?: string | null;
    user: { email: string; name?: string | null };
  };
}

interface StudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: any;
  classes: any[];
  onSaved: (student: any) => void;
  defaultTab?: 'info' | 'photos' | 'parents';
}

export function StudentDialog({ open, onOpenChange, student, classes, onSaved, defaultTab }: StudentDialogProps) {
  const isEdit = !!student;
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(defaultTab || 'info');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [enrollMessage, setEnrollMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', classId: '', birthDate: '' });

  // Photos state
  const [photos, setPhotos] = useState<StudentPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Parents state
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [parentSearch, setParentSearch] = useState('');
  const [parentResults, setParentResults] = useState<any[]>([]);
  const [searchingParents, setSearchingParents] = useState(false);
  const [linkingParent, setLinkingParent] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm({
        name: student?.name || '',
        classId: student?.classId || '',
        birthDate: student?.birthDate
          ? new Date(student.birthDate).toISOString().split('T')[0]
          : '',
      });
      setErrors({});
      setActiveTab(defaultTab || 'info');
      setEnrollStatus('idle');
      setEnrollMessage('');
      setParentSearch('');
      setParentResults([]);

      if (isEdit) {
        loadPhotos(student.id);
        loadParents(student.id);
      } else {
        setPhotos([]);
        setParentLinks([]);
      }
    }
  }, [open, student]);

  async function loadPhotos(id: string) {
    const res = await fetch(`/api/students/${id}/photos`);
    const data = await res.json();
    setPhotos(data.photos || []);
  }

  async function loadParents(id: string) {
    const res = await fetch(`/api/students/${id}/parents`);
    const data = await res.json();
    setParentLinks(data.parents || []);
  }

  // Debounced parent search
  useEffect(() => {
    if (parentSearch.length < 2) { setParentResults([]); return; }
    const t = setTimeout(async () => {
      setSearchingParents(true);
      try {
        const res = await fetch(`/api/parents?search=${encodeURIComponent(parentSearch)}&limit=8`);
        const data = await res.json();
        // Filter out already linked parents
        const linkedIds = parentLinks.map((l) => l.parentId);
        setParentResults((data.parents || []).filter((p: any) => !linkedIds.includes(p.id)));
      } finally {
        setSearchingParents(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [parentSearch, parentLinks]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isEdit) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'warning', title: 'Arquivo muito grande', description: 'Máximo 10MB.' });
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('setProfile', photos.length === 0 ? 'true' : 'false');

      const res = await fetch(`/api/students/${student.id}/photos`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setPhotos((prev) => [...prev, data.photo]);
        toast({ variant: 'success', title: 'Foto adicionada!' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: data.error });
      }
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSetProfile(photoId: string) {
    const res = await fetch(`/api/students/${student.id}/photos/${photoId}`, { method: 'PUT' });
    if (res.ok) {
      setPhotos((prev) => prev.map((p) => ({ ...p, isProfile: p.id === photoId })));
      toast({ variant: 'success', title: 'Foto de perfil atualizada!' });
    }
  }

  async function handleDeletePhoto(photoId: string) {
    const res = await fetch(`/api/students/${student.id}/photos/${photoId}`, { method: 'DELETE' });
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast({ variant: 'success', title: 'Foto removida.' });
    }
  }

  async function handleEnroll() {
    if (!isEdit) return;
    setEnrolling(true);
    setEnrollStatus('idle');
    setEnrollMessage('');
    try {
      // 1. Load face-api models (tiny ones only)
      setEnrollMessage('Carregando modelos de IA...');
      const faceapi = await import('@vladmandic/face-api');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

      // 2. Find the profile photo URL
      const profilePhoto = photos.find((p) => p.isProfile) || photos[0];
      if (!profilePhoto) {
        setEnrollStatus('error');
        setEnrollMessage('Nenhuma foto cadastrada. Adicione ao menos uma foto antes de treinar a biometria.');
        return;
      }

      setEnrollMessage('Analisando foto...');

      // 3. Load the image as HTMLImageElement
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = profilePhoto.url;
      });

      // 4. Detect single face with descriptor
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        setEnrollStatus('error');
        setEnrollMessage('Nenhum rosto encontrado na foto. Tente uma foto de frente com boa iluminação.');
        toast({ variant: 'destructive', title: 'Nenhum rosto encontrado', description: 'Use uma foto de frente com boa iluminação.' });
        return;
      }

      // 5. Convert Float32Array descriptor to number[]
      const descriptor = Array.from(detection.descriptor);

      // 6. POST to enrollment API
      setEnrollMessage('Salvando biometria...');
      const res = await fetch(`/api/students/${student.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor }),
      });
      const data = await res.json();

      if (res.ok) {
        setEnrollStatus('success');
        setEnrollMessage(data.message || 'Biometria treinada com sucesso!');
        toast({ variant: 'success', title: 'Biometria treinada!', description: student.name });
      } else {
        setEnrollStatus('error');
        setEnrollMessage(data.error || 'Falha ao treinar biometria.');
        toast({ variant: 'destructive', title: 'Erro na biometria', description: data.error });
      }
    } catch (err: any) {
      console.error('[enroll] error:', err);
      setEnrollStatus('error');
      setEnrollMessage('Erro inesperado ao processar biometria. Tente novamente.');
      toast({ variant: 'destructive', title: 'Erro na biometria', description: err?.message });
    } finally {
      setEnrolling(false);
      if (!enrollMessage) setEnrollMessage('');
    }
  }

  async function handleLinkParent(parent: any) {
    if (!isEdit) return;
    setLinkingParent(parent.id);
    try {
      const res = await fetch(`/api/students/${student.id}/parents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: parent.id,
          relationship: 'Responsável',
          isPrimary: parentLinks.length === 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setParentLinks((prev) => [...prev, data.link]);
        setParentSearch('');
        setParentResults([]);
        toast({ variant: 'success', title: `${parent.name || parent.user?.name} vinculado!` });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: data.error });
      }
    } finally {
      setLinkingParent(null);
    }
  }

  async function handleUnlinkParent(parentId: string) {
    if (!isEdit) return;
    const res = await fetch(`/api/students/${student.id}/parents`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId }),
    });
    if (res.ok) {
      setParentLinks((prev) => prev.filter((l) => l.parentId !== parentId));
      toast({ variant: 'success', title: 'Responsável desvinculado.' });
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Nome é obrigatório';
    if (!form.classId) e.classId = 'Turma é obrigatória';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('classId', form.classId);
      if (form.birthDate) formData.append('birthDate', form.birthDate);

      const url = isEdit ? `/api/students/${student.id}` : '/api/students';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErrors({ general: data.error || 'Erro ao salvar.' });
        toast({ variant: 'destructive', title: 'Erro', description: data.error });
      } else {
        toast({
          variant: 'success',
          title: isEdit ? 'Aluno atualizado!' : 'Aluno cadastrado!',
          description: form.name,
        });
        onSaved(data.student);
      }
    } finally {
      setLoading(false);
    }
  }

  const profilePhoto = photos.find((p) => p.isProfile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEdit ? 'Editar Aluno' : 'Cadastrar Aluno'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Gerencie informações, fotos e responsáveis.'
              : 'Preencha os dados para cadastrar um novo aluno.'}
          </DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="flex-shrink-0 mx-0">
              <TabsTrigger value="info">Dados</TabsTrigger>
              <TabsTrigger value="photos">
                Fotos {photos.length > 0 && <Badge variant="outline" className="ml-1 text-[10px] px-1">{photos.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="parents">
                Responsáveis {parentLinks.length > 0 && <Badge variant="outline" className="ml-1 text-[10px] px-1">{parentLinks.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* ── Info Tab ── */}
            <TabsContent value="info" className="flex-1 overflow-y-auto mt-0 pt-4">
              <form onSubmit={handleSubmit} className="space-y-4 pb-4">
                {/* Profile photo preview */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-border/40 flex-shrink-0">
                    <AvatarImage src={profilePhoto?.url || student?.photoUrl || ''} />
                    <AvatarFallback className="text-xl">
                      {form.name ? getInitials(form.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{form.name || 'Nome do aluno'}</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('photos')}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5"
                    >
                      <Camera className="h-3 w-3" />
                      {photos.length > 0 ? `${photos.length} foto${photos.length !== 1 ? 's' : ''}` : 'Adicionar fotos'}
                    </button>
                  </div>
                </div>

                {errors.general && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {errors.general}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-name">Nome completo *</Label>
                    <Input
                      id="s-name"
                      placeholder="Ana Silva Santos"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="s-birth">Data de nascimento</Label>
                    <Input
                      id="s-birth"
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Turma *</Label>
                    <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.classId && <p className="text-xs text-destructive">{errors.classId}</p>}
                  </div>
                </div>

                <div className="rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
                  🔒 As fotos são processadas para gerar vetores faciais biométricos, armazenados com criptografia AES-256 (LGPD).
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" loading={loading} className="flex-1">
                    Salvar alterações
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ── Photos Tab ── */}
            <TabsContent value="photos" className="flex-1 overflow-y-auto mt-0 pt-4">
              <div className="space-y-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Fotos para reconhecimento</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {photos.length}/10 · Ideal: 5+ fotos de ângulos diferentes
                    </p>
                  </div>
                  {photos.length < 10 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      loading={uploadingPhoto}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />

                {photos.length === 0 ? (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-foreground/20 hover:bg-accent/30 transition-all"
                  >
                    <Camera className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
                    <div className="text-center">
                      <p className="text-sm font-medium">Adicionar primeira foto</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG ou WebP · máx. 10MB<br />
                        Para melhor reconhecimento, adicione fotos de frente,<br />
                        perfil esquerdo e perfil direito
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group aspect-square">
                        <img
                          src={photo.url}
                          alt=""
                          className={cn(
                            'w-full h-full object-cover rounded-lg border-2 transition-all',
                            photo.isProfile ? 'border-foreground' : 'border-border/30'
                          )}
                        />
                        {photo.isProfile && (
                          <div className="absolute top-1.5 left-1.5 bg-foreground text-background rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
                            PERFIL
                          </div>
                        )}
                        {/* Hover actions */}
                        <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {!photo.isProfile && (
                            <button
                              onClick={() => handleSetProfile(photo.id)}
                              className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                              title="Definir como perfil"
                            >
                              <Star className="h-3.5 w-3.5 text-white" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="h-7 w-7 rounded-full bg-white/20 hover:bg-destructive/80 flex items-center justify-center transition-colors"
                            title="Remover foto"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-white" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add more */}
                    {photos.length < 10 && (
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-foreground/20 hover:bg-accent/30 transition-all"
                      >
                        <Plus className="h-5 w-5 text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground">Adicionar</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Angle guide */}
                {photos.length > 0 && photos.length < 5 && (
                  <div className="rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
                    💡 Para reconhecimento mais preciso, adicione fotos de: frente, perfil esquerdo, perfil direito, levemente acima e expressão neutra.
                  </div>
                )}

                {/* Biometric enrollment */}
                {photos.length > 0 && (
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Treinar Reconhecimento Facial</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Extrai o vetor biométrico da foto de perfil e armazena criptografado (AES-256).
                        </p>
                      </div>
                    </div>

                    {enrollStatus === 'success' && (
                      <div className="flex items-center gap-2 rounded-md bg-success/10 border border-success/20 p-2.5 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                        {enrollMessage}
                      </div>
                    )}
                    {enrollStatus === 'error' && (
                      <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        {enrollMessage}
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant={enrollStatus === 'success' ? 'outline' : 'default'}
                      onClick={handleEnroll}
                      loading={enrolling}
                      disabled={enrolling}
                      className="w-full gap-2"
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      {enrollStatus === 'success' ? 'Retreinar Biometria' : 'Treinar Biometria'}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Parents Tab ── */}
            <TabsContent value="parents" className="flex-1 overflow-y-auto mt-0 pt-4">
              <div className="space-y-4 pb-4">

                {/* Current parents */}
                {parentLinks.length > 0 && (
                  <div className="space-y-2">
                    {parentLinks.map((link) => {
                      const name = link.parent?.name || link.parent?.user?.name || 'Responsável';
                      const email = link.parent?.user?.email;
                      const phone = link.parent?.phone;
                      const whatsapp = phone?.replace(/\D/g, '');
                      return (
                        <div
                          key={link.parentId}
                          className="rounded-xl border border-border p-3.5 space-y-2"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                              <AvatarFallback className="text-xs bg-secondary">
                                {getInitials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{name}</p>
                                {link.isPrimary && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">Principal</Badge>
                                )}
                              </div>
                              <Badge variant="outline" className="text-[10px] mt-0.5">{link.relationship}</Badge>
                            </div>
                            <button
                              onClick={() => handleUnlinkParent(link.parentId)}
                              className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Contact info */}
                          <div className="space-y-1 pl-12">
                            {email && (
                              <a
                                href={`mailto:${email}`}
                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                              >
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{email}</span>
                              </a>
                            )}
                            {phone && (
                              <a
                                href={`https://wa.me/55${whatsapp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                              >
                                <MessageCircle className="h-3 w-3 flex-shrink-0 group-hover:text-success transition-colors" />
                                <span>{phone}</span>
                                <span className="text-[9px] text-success opacity-0 group-hover:opacity-100 transition-opacity">
                                  Abrir WhatsApp
                                </span>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Search + link parent */}
                <div className="space-y-2">
                  <Label className="text-xs">Vincular responsável</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou e-mail..."
                      value={parentSearch}
                      onChange={(e) => setParentSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  {searchingParents && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {parentResults.length > 0 && (
                    <div className="rounded-md border border-border overflow-hidden divide-y divide-border">
                      {parentResults.map((p) => {
                        const name = p.name || p.user?.name || p.user?.email;
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-3 p-2.5 hover:bg-accent transition-colors"
                          >
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              <AvatarFallback className="text-[10px] bg-secondary">
                                {getInitials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{name}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.user?.email}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLinkParent(p)}
                              loading={linkingParent === p.id}
                              className="flex-shrink-0 h-7 text-xs px-2.5"
                            >
                              <UserPlus className="h-3 w-3" />
                              Vincular
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {parentSearch.length >= 2 && !searchingParents && parentResults.length === 0 && (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Nenhum responsável encontrado para "{parentSearch}"
                    </div>
                  )}

                  {parentLinks.length === 0 && !parentSearch && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum responsável vinculado. Busque e vincule um responsável existente.
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          /* ── Create Mode (simple, no tabs) ── */
          <form onSubmit={handleSubmit} className="space-y-4 pt-1 flex-1 overflow-y-auto">
            {errors.general && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {errors.general}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Nome completo *</Label>
                <Input
                  id="s-name"
                  placeholder="Ana Silva Santos"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-birth">Data de nascimento</Label>
                <Input
                  id="s-birth"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Turma *</Label>
                <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classId && <p className="text-xs text-destructive">{errors.classId}</p>}
              </div>
            </div>

            <div className="rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
              🔒 As fotos são processadas para gerar vetores faciais biométricos com criptografia AES-256 (LGPD). Após cadastrar, adicione fotos na aba "Fotos".
            </div>

            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading} variant="default">
                Cadastrar aluno
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
