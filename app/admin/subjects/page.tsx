'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, BookOpen, Edit, Trash2, MoreHorizontal,
  Loader2, Calendar, Clock, Copy, Upload, Palette,
  CheckSquare, ChevronDown, GripVertical, Wand2,
  Sun, Sunset, Moon, LayoutTemplate, Zap,
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
import { toast } from '@/components/ui/toaster';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  color: string | null;
  _count: { schedules: number; events: number };
}

interface ClassItem {
  id: string;
  name: string;
  grade: string | null;
  shift: string | null;
}

interface ScheduleEntry {
  id: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  teacherName: string | null;
  subject: { id: string; name: string; color: string | null };
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS = [1, 2, 3, 4, 5];

const SUBJECT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  '#E11D48', '#84CC16', '#0EA5E9', '#A855F7', '#D946EF',
];

// ─── Preset subjects by level ─────────────────────────────────────────────

const LEVEL_PRESETS: Record<string, string[]> = {
  'Fundamental I': [
    'Português', 'Matemática', 'Ciências', 'História', 'Geografia',
    'Educação Física', 'Artes', 'Música', 'Religião', 'Inglês',
  ],
  'Fundamental II': [
    'Português', 'Matemática', 'Ciências', 'História', 'Geografia',
    'Educação Física', 'Artes', 'Inglês', 'Redação', 'Informática',
  ],
  'Ensino Médio': [
    'Português', 'Matemática', 'Física', 'Química', 'Biologia',
    'História', 'Geografia', 'Filosofia', 'Sociologia', 'Inglês',
    'Espanhol', 'Educação Física', 'Artes', 'Redação', 'Literatura',
  ],
  'Todas': [
    'Português', 'Matemática', 'História', 'Geografia', 'Ciências',
    'Física', 'Química', 'Biologia', 'Inglês', 'Espanhol',
    'Educação Física', 'Artes', 'Música', 'Filosofia', 'Sociologia',
    'Redação', 'Literatura', 'Informática', 'Religião', 'Educação Financeira',
  ],
};

// ─── Shift presets with auto-generated periods ─────────────────────────────

interface ShiftPreset {
  label: string;
  icon: typeof Sun;
  startHour: number;
  startMinute: number;
  periodMinutes: number;
  breakMinutes: number;
  periods: number;
  breakAfterPeriod: number; // intervalo after this period
  breakDuration: number; // intervalo duration in minutes
}

const SHIFT_PRESETS: Record<string, ShiftPreset> = {
  MANHA: {
    label: 'Manhã',
    icon: Sun,
    startHour: 7,
    startMinute: 0,
    periodMinutes: 50,
    breakMinutes: 10,
    periods: 6,
    breakAfterPeriod: 3,
    breakDuration: 20,
  },
  TARDE: {
    label: 'Tarde',
    icon: Sunset,
    startHour: 13,
    startMinute: 0,
    periodMinutes: 50,
    breakMinutes: 10,
    periods: 6,
    breakAfterPeriod: 3,
    breakDuration: 20,
  },
  NOITE: {
    label: 'Noite',
    icon: Moon,
    startHour: 19,
    startMinute: 0,
    periodMinutes: 45,
    breakMinutes: 10,
    periods: 4,
    breakAfterPeriod: 2,
    breakDuration: 15,
  },
};

function generatePeriodTimes(shift: ShiftPreset): { period: number; start: string; end: string }[] {
  const result: { period: number; start: string; end: string }[] = [];
  let h = shift.startHour;
  let m = shift.startMinute;

  for (let i = 1; i <= shift.periods; i++) {
    const startH = String(h).padStart(2, '0');
    const startM = String(m).padStart(2, '0');

    m += shift.periodMinutes;
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }

    const endH = String(h).padStart(2, '0');
    const endM = String(m).padStart(2, '0');

    result.push({ period: i, start: `${startH}:${startM}`, end: `${endH}:${endM}` });

    // Add break
    if (i === shift.breakAfterPeriod) {
      m += shift.breakDuration;
    } else {
      m += shift.breakMinutes;
    }
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
  }

  return result;
}

// ─── Schedule templates ─────────────────────────────────────────────────────

interface ScheduleTemplate {
  label: string;
  level: string;
  // grid[period][dayIndex] = subject name (dayIndex 0-4 for Mon-Fri)
  grid: (string | null)[][];
}

const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    label: 'Fundamental I (Manhã)',
    level: 'Fundamental I',
    grid: [
      // Period 1-6, Mon-Fri
      ['Português', 'Matemática', 'Português', 'Matemática', 'Português'],
      ['Português', 'Matemática', 'História', 'Ciências', 'Matemática'],
      ['Matemática', 'Ciências', 'Geografia', 'História', 'Artes'],
      ['Ciências', 'Inglês', 'Educação Física', 'Geografia', 'Música'],
      ['História', 'Educação Física', 'Artes', 'Inglês', 'Educação Física'],
      ['Geografia', 'Artes', 'Religião', 'Educação Física', 'Religião'],
    ],
  },
  {
    label: 'Fundamental II (Manhã)',
    level: 'Fundamental II',
    grid: [
      ['Português', 'Matemática', 'Português', 'Matemática', 'Português'],
      ['Português', 'Matemática', 'Ciências', 'Ciências', 'Matemática'],
      ['Matemática', 'Ciências', 'História', 'Inglês', 'Redação'],
      ['Inglês', 'Geografia', 'Geografia', 'História', 'Informática'],
      ['História', 'Educação Física', 'Artes', 'Educação Física', 'Educação Física'],
      ['Geografia', 'Artes', 'Informática', 'Redação', 'Artes'],
    ],
  },
  {
    label: 'Ensino Médio (Manhã)',
    level: 'Ensino Médio',
    grid: [
      ['Português', 'Matemática', 'Português', 'Matemática', 'Português'],
      ['Matemática', 'Física', 'Química', 'Biologia', 'Matemática'],
      ['Física', 'Química', 'Biologia', 'História', 'Inglês'],
      ['Química', 'História', 'Geografia', 'Filosofia', 'Redação'],
      ['Biologia', 'Geografia', 'Filosofia', 'Sociologia', 'Literatura'],
      ['Educação Física', 'Sociologia', 'Educação Física', 'Artes', 'Educação Física'],
    ],
  },
];

// ─── Default color assignment ──────────────────────────────────────────────

function getDefaultColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const [tab, setTab] = useState<'subjects' | 'schedule'>('schedule');

  return (
    <div className="flex flex-col flex-1">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm px-3 md:px-6 pt-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'subjects' | 'schedule')}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="schedule" className="flex-1 sm:flex-initial gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Grade Horária
            </TabsTrigger>
            <TabsTrigger value="subjects" className="flex-1 sm:flex-initial gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              Matérias
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'schedule' ? <ScheduleTab /> : <SubjectsTab />}
    </div>
  );
}

// ─── Subjects Tab ─────────────────────────────────────────────────────────────

function SubjectsTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingPreset, setAddingPreset] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('Todas');
  const [importDialog, setImportDialog] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [presetsDialog, setPresetsDialog] = useState(false);

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
    setColor(SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)]);
    setDialogOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setName(s.name);
    setColor(s.color || getDefaultColor(s.name));
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
          body: JSON.stringify({ name, color }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        toast({ variant: 'success', title: 'Matéria atualizada' });
      } else {
        const res = await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, color }),
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
        body: JSON.stringify({ name: presetName, color: getDefaultColor(presetName) }),
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
    const presets = LEVEL_PRESETS[selectedLevel] || [];
    const missing = presets.filter(p => !existingNames.has(p.toLowerCase()));
    if (missing.length === 0) {
      toast({ variant: 'warning', title: 'Todas as matérias já existem' });
      return;
    }
    setAddingPreset('all');
    try {
      for (const n of missing) {
        await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, color: getDefaultColor(n) }),
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

  async function handleImportCsv() {
    const names = csvText.split(/[\n,;]+/).map(n => n.trim()).filter(n => n.length > 0 && !existingNames.has(n.toLowerCase()));
    if (names.length === 0) {
      toast({ variant: 'warning', title: 'Nenhuma matéria nova encontrada' });
      return;
    }
    setImportBusy(true);
    try {
      let count = 0;
      for (const n of names) {
        const res = await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, color: getDefaultColor(n) }),
        });
        if (res.ok) count++;
      }
      toast({ variant: 'success', title: `${count} matérias importadas` });
      setImportDialog(false);
      setCsvText('');
      fetchSubjects();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao importar' });
    } finally {
      setImportBusy(false);
    }
  }

  const existingNames = new Set(subjects.map(s => s.name.toLowerCase()));
  const currentPresets = LEVEL_PRESETS[selectedLevel] || [];
  const availablePresets = currentPresets.filter(p => !existingNames.has(p.toLowerCase()));

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Input
          placeholder="Buscar matéria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" />
                Adicionar
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nova Matéria
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPresetsDialog(true)}>
                <CheckSquare className="h-4 w-4 mr-2" /> Adicionar por Nível
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" /> Importar Lista
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
          {filtered.map((s) => {
            const c = s.color || getDefaultColor(s.name);
            return (
              <Card key={s.id} className="group relative overflow-hidden hover:border-border transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: c + '20', border: `1px solid ${c}40` }}
                    >
                      <BookOpen className="h-4 w-4" style={{ color: c }} strokeWidth={1.5} />
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
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Matéria' : 'Nova Matéria'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize o nome e cor da matéria.' : 'Informe o nome e escolha uma cor.'}
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
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-7 w-7 rounded-full transition-all',
                      color === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110' : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editing ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog} onOpenChange={(o) => { if (!o) setImportDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Matérias</DialogTitle>
            <DialogDescription>
              Cole os nomes das matérias, um por linha, ou separados por vírgula/ponto-e-vírgula.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Matemática&#10;Português&#10;História&#10;..."
              className="w-full h-32 rounded-xl border border-input bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {csvText.split(/[\n,;]+/).filter(n => n.trim()).length} matéria(s) detectada(s)
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportDialog(false)}>Cancelar</Button>
            <Button onClick={handleImportCsv} loading={importBusy}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Presets Dialog */}
      <Dialog open={presetsDialog} onOpenChange={(o) => { if (!o) setPresetsDialog(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar por Nível</DialogTitle>
            <DialogDescription>
              Selecione o nível de ensino e adicione matérias padrão rapidamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.keys(LEVEL_PRESETS).map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    selectedLevel === level
                      ? 'bg-primary text-primary-foreground shadow-apple-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
            {availablePresets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todas as matérias deste nível já foram adicionadas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availablePresets.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleQuickAdd(p)}
                    disabled={!!addingPreset}
                    className={cn(
                      'px-2.5 py-1.5 rounded-full text-xs border transition-colors flex items-center gap-1.5',
                      'hover:bg-accent hover:border-primary/30',
                      addingPreset === p && 'opacity-50'
                    )}
                    style={{ borderColor: getDefaultColor(p) + '40' }}
                  >
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: getDefaultColor(p) }} />
                    {addingPreset === p ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPresetsDialog(false)}>Fechar</Button>
            <Button onClick={handleAddAll} disabled={!!addingPreset || availablePresets.length === 0}>
              {addingPreset === 'all' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckSquare className="h-3 w-3 mr-1" />}
              Adicionar todas ({availablePresets.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Schedule Tab (Drag & Drop Builder) ─────────────────────────────────────

function ScheduleTab() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Shift/template
  const [selectedShift, setSelectedShift] = useState<string>('MANHA');
  const [periodTimes, setPeriodTimes] = useState<{ period: number; start: string; end: string }[]>([]);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Drag state
  const [draggingSubject, setDraggingSubject] = useState<Subject | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    subjectId: '', dayOfWeek: '1', period: '1', startTime: '08:00', endTime: '08:50', teacherName: '',
  });
  const [addSaving, setAddSaving] = useState(false);

  // Copy dialog
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyBusy, setCopyBusy] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [clsRes, subRes] = await Promise.all([
          fetch('/api/classes'),
          fetch('/api/subjects'),
        ]);
        const clsData = await clsRes.json();
        const subData = await subRes.json();
        const clsList = Array.isArray(clsData) ? clsData : clsData.classes ?? [];
        setClasses(clsList);
        setSubjects(subData.subjects ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Auto-detect shift from selected class
  useEffect(() => {
    const cls = classes.find(c => c.id === selectedClass);
    if (cls?.shift && SHIFT_PRESETS[cls.shift]) {
      setSelectedShift(cls.shift);
    }
  }, [selectedClass, classes]);

  // Generate period times when shift changes
  useEffect(() => {
    const preset = SHIFT_PRESETS[selectedShift];
    if (preset) {
      setPeriodTimes(generatePeriodTimes(preset));
    }
  }, [selectedShift]);

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

  // ─── Drag & Drop handlers ────────────────────────────────

  function handleDragStart(subject: Subject) {
    setDraggingSubject(subject);
  }

  function handleDragOver(e: React.DragEvent, slotKey: string) {
    e.preventDefault();
    setDragOverSlot(slotKey);
  }

  function handleDragLeave() {
    setDragOverSlot(null);
  }

  async function handleDrop(e: React.DragEvent, day: number, period: number) {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggingSubject || !selectedClass) return;

    const times = periodTimes.find(p => p.period === period);
    const startTime = times?.start || `${String(7 + period).padStart(2, '0')}:00`;
    const endTime = times?.end || `${String(7 + period).padStart(2, '0')}:50`;

    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClass,
          subjectId: draggingSubject.id,
          dayOfWeek: day,
          period,
          startTime,
          endTime,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      fetchSchedule();
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Erro ao adicionar' });
    }

    setDraggingSubject(null);
  }

  // ─── Template application ────────────────────────────────

  async function applyTemplate(template: ScheduleTemplate) {
    if (!selectedClass) return;

    // First, ensure all subjects exist
    const subjectMap = new Map(subjects.map(s => [s.name.toLowerCase(), s]));
    const missingSubjects = new Set<string>();
    template.grid.forEach(row => row.forEach(name => {
      if (name && !subjectMap.has(name.toLowerCase())) missingSubjects.add(name);
    }));

    setApplyingTemplate(true);

    try {
      // Create missing subjects
      for (const name of Array.from(missingSubjects)) {
        const res = await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, color: getDefaultColor(name) }),
        });
        if (res.ok) {
          const data = await res.json();
          subjectMap.set(name.toLowerCase(), data.subject || data);
        }
      }

      // Refresh subjects
      const subRes = await fetch('/api/subjects');
      const subData = await subRes.json();
      const refreshedSubjects: Subject[] = subData.subjects ?? [];
      setSubjects(refreshedSubjects);
      const freshMap = new Map(refreshedSubjects.map(s => [s.name.toLowerCase(), s]));

      // Apply grid
      const times = generatePeriodTimes(SHIFT_PRESETS[selectedShift]);
      let created = 0;

      for (let periodIdx = 0; periodIdx < template.grid.length; periodIdx++) {
        const row = template.grid[periodIdx];
        for (let dayIdx = 0; dayIdx < row.length; dayIdx++) {
          const subjectName = row[dayIdx];
          if (!subjectName) continue;

          const subject = freshMap.get(subjectName.toLowerCase());
          if (!subject) continue;

          const time = times[periodIdx];
          const startTime = time?.start || `${String(7 + periodIdx + 1).padStart(2, '0')}:00`;
          const endTime = time?.end || `${String(7 + periodIdx + 1).padStart(2, '0')}:50`;

          await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              classId: selectedClass,
              subjectId: subject.id,
              dayOfWeek: WEEKDAYS[dayIdx],
              period: periodIdx + 1,
              startTime,
              endTime,
            }),
          });
          created++;
        }
      }

      toast({ variant: 'success', title: `Grade aplicada: ${created} aulas criadas` });
      setTemplateDialog(false);
      fetchSchedule();
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Erro ao aplicar template' });
    } finally {
      setApplyingTemplate(false);
    }
  }

  // ─── Manual add ────────────────────────────────

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

  async function handleCopySchedule() {
    if (!copyFrom || !selectedClass) return;
    setCopyBusy(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromClassId: copyFrom, toClassId: selectedClass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ variant: 'success', title: `${data.copied} aulas copiadas` });
      setCopyOpen(false);
      fetchSchedule();
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Erro ao copiar' });
    } finally {
      setCopyBusy(false);
    }
  }

  function openAddForSlot(day: number, period: number) {
    const times = periodTimes.find(p => p.period === period);
    setAddForm({
      subjectId: subjects[0]?.id || '',
      dayOfWeek: String(day),
      period: String(period),
      startTime: times?.start || `${String(7 + period).padStart(2, '0')}:00`,
      endTime: times?.end || `${String(7 + period).padStart(2, '0')}:50`,
      teacherName: '',
    });
    setAddOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build grid data
  const shiftPreset = SHIFT_PRESETS[selectedShift];
  const numPeriods = Math.max(shiftPreset?.periods || 6, schedules.reduce((max, s) => Math.max(max, s.period), 0));
  const periods = Array.from({ length: numPeriods }, (_, i) => i + 1);
  const grid: Record<string, ScheduleEntry | undefined> = {};
  schedules.forEach(s => { grid[`${s.dayOfWeek}-${s.period}`] = s; });

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-0">
      {/* Subject Palette (sidebar) */}
      {selectedClass && (
        <div className="lg:w-[200px] border-b lg:border-b-0 lg:border-r border-border bg-background/50 p-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider hidden lg:block mb-1">
            Arraste para a grade
          </p>
          {subjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma matéria criada. Vá para a aba Matérias.
            </p>
          ) : (
            subjects.map((s) => {
              const c = s.color || getDefaultColor(s.name);
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => handleDragStart(s)}
                  onDragEnd={() => setDraggingSubject(null)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none flex-shrink-0"
                  style={{ borderColor: c + '40', backgroundColor: c + '10' }}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 hidden lg:block" />
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                  <span className="text-xs font-medium truncate whitespace-nowrap" style={{ color: c }}>
                    {s.name}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 p-3 md:p-4 space-y-3 min-w-0">
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="h-9 rounded-xl border border-input bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Selecionar turma...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.grade ? ` (${c.grade})` : ''}
              </option>
            ))}
          </select>

          {selectedClass && (
            <>
              {/* Shift selector */}
              <div className="flex items-center rounded-lg border border-border overflow-hidden">
                {Object.entries(SHIFT_PRESETS).map(([key, preset]) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedShift(key)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors',
                        selectedShift === key
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="hidden sm:inline">{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              <Button size="sm" variant="outline" onClick={() => setTemplateDialog(true)}>
                <Wand2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1">Template</span>
              </Button>

              <Button size="sm" variant="outline" onClick={() => { setCopyFrom(''); setCopyOpen(true); }}>
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1">Copiar</span>
              </Button>
            </>
          )}
        </div>

        {/* Empty state */}
        {!selectedClass && (
          <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <Calendar className="h-8 w-8 text-muted-foreground/30" />
            <p className="font-semibold">Selecione uma turma</p>
            <p className="text-sm text-muted-foreground">
              Escolha a turma para montar a grade horária.
            </p>
          </Card>
        )}

        {selectedClass && scheduleLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Visual Grid Table with Drag & Drop */}
        {selectedClass && !scheduleLoading && (
          <div className="overflow-x-auto rounded-2xl bg-card shadow-apple-card">
              <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-muted-foreground w-[80px]">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Aula
                    </th>
                    {WEEKDAYS.map((day) => (
                      <th key={day} className="text-center px-1 py-2.5 text-[10px] font-semibold text-muted-foreground min-w-[100px] lg:min-w-[120px]">
                        {DAYS[day]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => {
                    const times = periodTimes.find(p => p.period === period);
                    return (
                      <tr key={period} className="border-b border-border/50">
                        <td className="px-2 py-1">
                          <div className="text-center">
                            <span className="text-xs font-mono font-semibold text-foreground">{period}ª</span>
                            {times && (
                              <p className="text-[9px] text-muted-foreground leading-tight">
                                {times.start}
                                <br />
                                {times.end}
                              </p>
                            )}
                          </div>
                        </td>
                        {WEEKDAYS.map((day) => {
                          const entry = grid[`${day}-${period}`];
                          const slotKey = `${day}-${period}`;
                          const isDragOver = dragOverSlot === slotKey;

                          if (entry) {
                            const c = entry.subject.color || getDefaultColor(entry.subject.name);
                            return (
                              <td key={day} className="px-0.5 py-0.5">
                                <div
                                  className="group relative rounded-md px-2 py-1.5 cursor-default transition-all hover:shadow-md"
                                  style={{ backgroundColor: c + '18', border: `1px solid ${c}30` }}
                                  onDragOver={(e) => handleDragOver(e, slotKey)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, day, period)}
                                >
                                  <p className="text-[11px] font-semibold truncate" style={{ color: c }}>
                                    {entry.subject.name}
                                  </p>
                                  {entry.teacherName && (
                                    <p className="text-[9px] text-muted-foreground/70 truncate">{entry.teacherName}</p>
                                  )}
                                  <button
                                    onClick={() => handleDeleteSchedule(entry.id)}
                                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td key={day} className="px-0.5 py-0.5">
                              <div
                                className={cn(
                                  'w-full h-[44px] rounded-md border border-dashed transition-all flex items-center justify-center',
                                  isDragOver
                                    ? 'border-primary bg-primary/10 scale-[1.02]'
                                    : 'border-border/30 hover:border-primary/30 hover:bg-accent/20'
                                )}
                                onDragOver={(e) => handleDragOver(e, slotKey)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, day, period)}
                                onClick={() => openAddForSlot(day, period)}
                              >
                                {isDragOver ? (
                                  <Plus className="h-4 w-4 text-primary animate-pulse" />
                                ) : (
                                  <Plus className="h-3 w-3 text-muted-foreground/20" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            {(schedules.length > 0 || draggingSubject) && (
              <div className="flex items-center gap-3 px-3 py-2 border-t border-border bg-secondary/10 flex-wrap">
                {draggingSubject ? (
                  <p className="text-xs text-primary font-medium animate-pulse">
                    Solte &quot;{draggingSubject.name}&quot; em um slot vazio
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {schedules.length} aula{schedules.length !== 1 ? 's' : ''} na grade
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Dialog */}
      <Dialog open={templateDialog} onOpenChange={(o) => { if (!o) setTemplateDialog(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              Aplicar Template de Grade
            </DialogTitle>
            <DialogDescription>
              Escolha um modelo pronto e preencha a grade automaticamente. As matérias que faltarem serão criadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {SCHEDULE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.label}
                onClick={() => applyTemplate(tmpl)}
                disabled={applyingTemplate}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/30 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                      {tmpl.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tmpl.grid.length} aulas/dia &middot; {tmpl.grid.flat().filter(Boolean).length} slots preenchidos
                    </p>
                  </div>
                  <Zap className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                {/* Mini preview */}
                <div className="flex gap-0.5 mt-2">
                  {WEEKDAYS.map((_, dayIdx) => (
                    <div key={dayIdx} className="flex-1 flex flex-col gap-0.5">
                      {tmpl.grid.map((row, periodIdx) => {
                        const name = row[dayIdx];
                        const c = name ? getDefaultColor(name) : 'transparent';
                        return (
                          <div
                            key={periodIdx}
                            className="h-1.5 rounded-sm"
                            style={{ backgroundColor: name ? c + '60' : 'var(--border)' }}
                            title={name || ''}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {applyingTemplate && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Aplicando template...</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
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
                  className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                >
                  {WEEKDAYS.map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Aula</Label>
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

      {/* Copy Schedule Dialog */}
      <Dialog open={copyOpen} onOpenChange={(o) => { if (!o) setCopyOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copiar Grade Horária</DialogTitle>
            <DialogDescription>
              Selecione a turma de origem. A grade atual será substituída.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-2">
              <Label>Copiar de</Label>
              <select
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              >
                <option value="">Selecionar turma...</option>
                {classes.filter(c => c.id !== selectedClass).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.grade ? ` (${c.grade})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCopyOpen(false)}>Cancelar</Button>
            <Button onClick={handleCopySchedule} loading={copyBusy} disabled={!copyFrom}>
              <Copy className="h-4 w-4 mr-1" />
              Copiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
