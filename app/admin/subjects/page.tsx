'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, BookOpen, Edit, Trash2, MoreHorizontal,
  Loader2, Calendar, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { AdminHeader } from '@/components/admin/header';
import { toast } from '@/components/ui/toaster';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  _count: { schedules: number; events: number };
}

interface ClassItem {
  id: string;
  name: string;
  grade: string | null;
}

interface ScheduleEntry {
  id: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  teacherName: string | null;
  subject: { id: string; name: string };
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const [tab, setTab] = useState<'subjects' | 'schedule'>('subjects');

  return (
    <div className="flex flex-col flex-1">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm px-3 md:px-6 pt-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'subjects' | 'schedule')}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="subjects" className="flex-1 sm:flex-initial gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              Matérias
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1 sm:flex-initial gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Grade Horária
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'subjects' ? <SubjectsTab /> : <ScheduleTab />}
    </div>
  );
}

// ─── Subjects Tab ─────────────────────────────────────────────────────────────

const PRESET_SUBJECTS = [
  'Português', 'Matemática', 'História', 'Geografia', 'Ciências',
  'Física', 'Química', 'Biologia', 'Inglês', 'Espanhol',
  'Educação Física', 'Artes', 'Música', 'Filosofia', 'Sociologia',
  'Redação', 'Literatura', 'Informática', 'Religião', 'Educação Financeira',
];

function SubjectsTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingPreset, setAddingPreset] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/subjects');
      const data = await res.json();
      setSubjects(data.subjects ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  const filtered = subjects.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setName('');
    setDialogOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setName(s.name);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/subjects/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        toast({ variant: 'success', title: 'Matéria atualizada' });
      } else {
        const res = await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        toast({ variant: 'success', title: 'Matéria criada' });
      }
      setDialogOpen(false);
      fetchSubjects();
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Erro' });
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickAdd(presetName: string) {
    setAddingPreset(presetName);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ variant: 'success', title: `${presetName} criada` });
      fetchSubjects();
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Erro' });
    } finally {
      setAddingPreset(null);
    }
  }

  async function handleAddAll() {
    const missing = PRESET_SUBJECTS.filter(p => !existingNames.has(p.toLowerCase()));
    if (missing.length === 0) {
      toast({ variant: 'warning', title: 'Todas as matérias já existem' });
      return;
    }
    setAddingPreset('all');
    try {
      for (const name of missing) {
        await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      }
      toast({ variant: 'success', title: `${missing.length} matérias criadas` });
      fetchSubjects();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar matérias' });
    } finally {
      setAddingPreset(null);
    }
  }

  const existingNames = new Set(subjects.map(s => s.name.toLowerCase()));
  const availablePresets = PRESET_SUBJECTS.filter(p => !existingNames.has(p.toLowerCase()));

  async function handleDelete(s: Subject) {
    if (!confirm(`Excluir matéria "${s.name}"?`)) return;
    try {
      const res = await fetch(`/api/subjects/${s.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ variant: 'success', title: 'Matéria excluída' });
      fetchSubjects();
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Erro ao excluir' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar matéria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
          className="max-w-xs"
        />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova Matéria
        </Button>
      </div>

      {/* Quick-add presets */}
      {availablePresets.length > 0 && (
        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">Adicionar rapidamente</p>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleAddAll} disabled={!!addingPreset}>
              {addingPreset === 'all' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Adicionar todas ({availablePresets.length})
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availablePresets.map((p) => (
              <button
                key={p}
                onClick={() => handleQuickAdd(p)}
                disabled={!!addingPreset}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border border-border hover:bg-accent hover:border-primary/30 transition-colors',
                  addingPreset === p && 'opacity-50'
                )}
              >
                {addingPreset === p ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : <Plus className="h-3 w-3 inline mr-0.5" />}
                {p}
              </button>
            ))}
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <BookOpen className="h-8 w-8 text-muted-foreground/30" />
          <p className="font-semibold">Nenhuma matéria cadastrada</p>
          <p className="text-sm text-muted-foreground">
            Crie matérias para organizar a grade horária.
          </p>
          <Button onClick={openCreate} className="mt-2">
            <Plus className="h-4 w-4" /> Nova Matéria
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((s) => (
            <Card key={s.id} className="group relative overflow-hidden hover:border-border transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="h-8 w-8 rounded-md border border-border flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(s)}>
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(s)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardTitle className="text-base mb-2">{s.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    <Calendar className="h-2.5 w-2.5 mr-1" />
                    {s._count.schedules} aula{s._count.schedules !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Matéria' : 'Nova Matéria'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize o nome da matéria.' : 'Informe o nome da nova matéria.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="subject-name">Nome *</Label>
              <Input
                id="subject-name"
                placeholder="Ex: Matemática"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editing ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

function ScheduleTab() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    subjectId: '', dayOfWeek: '1', period: '1', startTime: '08:00', endTime: '08:50', teacherName: '',
  });
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [clsRes, subRes] = await Promise.all([
          fetch('/api/classes'),
          fetch('/api/subjects'),
        ]);
        const clsData = await clsRes.json();
        const subData = await subRes.json();
        setClasses(Array.isArray(clsData) ? clsData : clsData.classes ?? []);
        setSubjects(subData.subjects ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fetchSchedule = useCallback(async () => {
    if (!selectedClass) return;
    setScheduleLoading(true);
    try {
      const res = await fetch(`/api/schedules?classId=${selectedClass}`);
      const data = await res.json();
      setSchedules(data.schedules ?? []);
    } finally {
      setScheduleLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  async function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.subjectId || !selectedClass) return;
    setAddSaving(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass, ...addForm }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ variant: 'success', title: 'Aula adicionada à grade' });
      setAddOpen(false);
      fetchSchedule();
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Erro' });
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDeleteSchedule(id: string) {
    try {
      const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast({ variant: 'success', title: 'Aula removida' });
      fetchSchedule();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao remover' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group schedules by day
  const byDay: Record<number, ScheduleEntry[]> = {};
  schedules.forEach((s) => {
    if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = [];
    byDay[s.dayOfWeek].push(s);
  });

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Selecionar turma...</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.grade ? ` (${c.grade})` : ''}
            </option>
          ))}
        </select>

        {selectedClass && (
          <Button size="sm" onClick={() => {
            setAddForm({ subjectId: subjects[0]?.id || '', dayOfWeek: '1', period: '1', startTime: '08:00', endTime: '08:50', teacherName: '' });
            setAddOpen(true);
          }}>
            <Plus className="h-4 w-4" />
            Adicionar Aula
          </Button>
        )}
      </div>

      {!selectedClass && (
        <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <Calendar className="h-8 w-8 text-muted-foreground/30" />
          <p className="font-semibold">Selecione uma turma</p>
          <p className="text-sm text-muted-foreground">
            Escolha a turma acima para visualizar e editar a grade horária.
          </p>
        </Card>
      )}

      {selectedClass && scheduleLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {selectedClass && !scheduleLoading && (
        <>
          {schedules.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma aula cadastrada. Adicione aulas à grade horária.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {WEEKDAYS.map((day) => {
                const daySchedules = (byDay[day] || []).sort((a, b) => a.period - b.period);
                if (daySchedules.length === 0) return null;
                return (
                  <div key={day}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {DAYS[day]}
                    </h3>
                    <Card className="overflow-hidden">
                      <div className="divide-y divide-border">
                        {daySchedules.map((s) => (
                          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Badge variant="outline" className="text-[10px] font-mono w-7 justify-center">
                              {s.period}
                            </Badge>
                            <span className="text-xs text-muted-foreground w-[90px]">
                              {s.startTime} — {s.endTime}
                            </span>
                            <span className="text-sm font-medium flex-1">{s.subject.name}</span>
                            {s.teacherName && (
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {s.teacherName}
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteSchedule(s.id)}
                              className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add Schedule Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) setAddOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Aula</DialogTitle>
            <DialogDescription>Configure o horário da aula na grade.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSchedule} className="space-y-3 mt-2">
            <div className="space-y-2">
              <Label>Matéria *</Label>
              <select
                value={addForm.subjectId}
                onChange={(e) => setAddForm((f) => ({ ...f, subjectId: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              >
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <select
                  value={addForm.dayOfWeek}
                  onChange={(e) => setAddForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                >
                  {WEEKDAYS.map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Período/Aula</Label>
                <Input
                  type="number" min={1} max={12}
                  value={addForm.period}
                  onChange={(e) => setAddForm((f) => ({ ...f, period: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="time"
                  value={addForm.startTime}
                  onChange={(e) => setAddForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={addForm.endTime}
                  onChange={(e) => setAddForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Professor (opcional)</Label>
              <Input
                placeholder="Nome do professor"
                value={addForm.teacherName}
                onChange={(e) => setAddForm((f) => ({ ...f, teacherName: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={addSaving}>Adicionar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
