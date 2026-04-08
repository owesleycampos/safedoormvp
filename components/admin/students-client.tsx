'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Search, MoreHorizontal, Edit, Trash2,
  Camera, Users, GraduationCap, Eye, ScanFace, ScanLine,
  Upload, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StudentDialog } from '@/components/admin/student-dialog';
import { toast } from '@/components/ui/toaster';
import { cn, getInitials } from '@/lib/utils';

interface StudentsClientProps {
  students: any[];
  classes: any[];
}

export function StudentsClient({ students: initialStudents, classes }: StudentsClientProps) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [dialogDefaultTab, setDialogDefaultTab] = useState<'info' | 'photos' | 'parents' | 'history'>('info');
  const [importing, setImporting] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [nameCol, setNameCol] = useState(0);
  const [birthCol, setBirthCol] = useState(-1);
  const [orphanAlertOpen, setOrphanAlertOpen] = useState(true);

  const orphanStudents = students.filter((s) => !s.parents || s.parents.length === 0);

  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.class?.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.registration || '').includes(search);
    const matchClass = filterClass === 'all' || s.classId === filterClass;
    return matchSearch && matchClass;
  });

  function handleEdit(student: any, tab: 'info' | 'photos' | 'parents' | 'history' = 'info') {
    setEditingStudent(student);
    setDialogDefaultTab(tab);
    setDialogOpen(true);
  }

  async function handleDelete(student: any) {
    if (!confirm(`Remover ${student.name}? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/students/${student.id}`, { method: 'DELETE' });
    if (res.ok) {
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      toast({ variant: 'success', title: 'Aluno removido', description: student.name });
    }
  }

  async function handleToggleRecognition(student: any) {
    const newValue = !student.recognitionEnabled;
    const res = await fetch(`/api/students/${student.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recognitionEnabled: newValue }),
    });
    if (res.ok) {
      setStudents((prev) => prev.map((s) =>
        s.id === student.id ? { ...s, recognitionEnabled: newValue } : s
      ));
      toast({
        variant: newValue ? 'success' : 'warning',
        title: newValue ? 'Reconhecimento ativado' : 'Reconhecimento desativado',
        description: student.name,
      });
    }
  }

  function handleSaved(student: any) {
    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.id === student.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = student;
        return updated;
      }
      return [student, ...prev];
    });
    setDialogOpen(false);
    setEditingStudent(null);
  }

  function handleImportCsv() {
    if (filterClass === 'all') {
      toast({ variant: 'destructive', title: 'Selecione uma turma', description: 'Filtre por turma antes de importar.' });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,.xlsx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        toast({ variant: 'destructive', title: 'Arquivo vazio' });
        return;
      }
      const parsed = lines.map(line => {
        const sep = line.includes(';') ? ';' : ',';
        return line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
      });
      const first = parsed[0].map(h => h.toLowerCase());
      const hasHeader = first.some(h => ['nome', 'name', 'aluno', 'estudante'].includes(h));
      if (hasHeader) {
        setCsvHeaders(parsed[0]);
        setCsvRows(parsed.slice(1));
        const ni = first.findIndex(h => ['nome', 'name', 'aluno', 'estudante'].includes(h));
        const bi = first.findIndex(h => ['nascimento', 'birth', 'data_nascimento', 'data de nascimento', 'birthdate', 'dt_nasc'].includes(h));
        setNameCol(ni >= 0 ? ni : 0);
        setBirthCol(bi >= 0 ? bi : -1);
      } else {
        setCsvHeaders(parsed[0].map((_, i) => `Coluna ${i + 1}`));
        setCsvRows(parsed);
        setNameCol(0);
        setBirthCol(parsed[0].length > 1 ? 1 : -1);
      }
      setImportDialog(true);
    };
    input.click();
  }

  async function handleConfirmImport() {
    setImporting(true);
    try {
      const students = csvRows
        .map(row => ({
          name: row[nameCol] || '',
          birthDate: birthCol >= 0 ? row[birthCol] : undefined,
        }))
        .filter(s => s.name.trim());
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: filterClass, students }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ variant: 'success', title: data.message });
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: data.error });
      }
      setImportDialog(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro de conexão' });
    } finally {
      setImporting(false);
    }
  }

  const byClass: Record<string, any[]> = {};
  filtered.forEach((s) => {
    const cls = s.class?.name || 'Sem turma';
    if (!byClass[cls]) byClass[cls] = [];
    byClass[cls].push(s);
  });

  const withBiometry = students.filter((s) => s.azurePersonId || s.faceVector).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Alunos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {students.length} aluno{students.length !== 1 ? 's' : ''} cadastrado{students.length !== 1 ? 's' : ''}
            {withBiometry > 0 && <span className="text-muted-foreground"> · {withBiometry} com biometria</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportCsv}
            disabled={importing}
            className="hidden md:flex items-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary transition-all duration-200"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar CSV
          </button>
          <button
            onClick={() => { setEditingStudent(null); setDialogDefaultTab('info'); setDialogOpen(true); }}
            className="flex items-center gap-2 h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Aluno</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </motion.div>

      {/* Search + Filter */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar por nome, turma ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-10"
          />
        </div>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="h-11 rounded-md border border-input bg-card px-3 pr-8 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        >
          <option value="all">Todas as turmas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </motion.div>

      {/* Orphan alert */}
      {orphanStudents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="overflow-hidden">
            <button
              onClick={() => setOrphanAlertOpen(!orphanAlertOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs flex-1">
                <span className="font-semibold">{orphanStudents.length} aluno{orphanStudents.length !== 1 ? 's' : ''}</span>
                <span className="text-muted-foreground"> sem responsável vinculado</span>
              </p>
              {orphanAlertOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {orphanAlertOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 space-y-1">
                    {orphanStudents.slice(0, 8).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleEdit(s, 'parents')}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1 rounded-md hover:bg-secondary/30 px-2 -mx-2"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                        <span className="truncate">{s.name}</span>
                        <span className="text-muted-foreground/40 ml-auto">{s.class?.name}</span>
                      </button>
                    ))}
                    {orphanStudents.length > 8 && (
                      <p className="text-[10px] text-muted-foreground pl-4">
                        e mais {orphanStudents.length - 8}...
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* Student List */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center mb-4">
            <GraduationCap className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum aluno encontrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Tente ajustar os filtros ou adicionar um novo aluno</p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byClass).sort(([a], [b]) => a.localeCompare(b)).map(([className, classStudents], groupIdx) => (
            <motion.div
              key={className}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + groupIdx * 0.05 }}
            >
              {/* Class header */}
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <div className="flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {className}
                </span>
                <span className="text-[11px] text-muted-foreground/60">{classStudents.length}</span>
              </div>

              <Card className="overflow-hidden">
                <div className="divide-y divide-border/50">
                  {classStudents.map((student, i) => (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className="flex items-center gap-3 px-4 md:px-5 py-3.5 hover:bg-secondary/30 transition-all duration-150 group cursor-pointer"
                      onClick={() => router.push(`/admin/students/${student.id}/history`)}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={student.photos?.[0]?.url || student.photoUrl || ''}
                            alt={student.name}
                          />
                          <AvatarFallback className="text-xs font-medium bg-muted text-muted-foreground">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                          (student.azurePersonId || student.faceVector) ? 'bg-foreground' : 'bg-muted-foreground/30'
                        )} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-medium truncate">{student.name}</p>
                          {!student.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">Inativo</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {student.photos?.length > 0 && `${student.photos.length} foto${student.photos.length !== 1 ? 's' : ''} · `}
                          {student.parents?.length || 0} responsável(is)
                          {student.recognitionEnabled === false && (student.azurePersonId || student.faceVector) && (
                            <span className="text-muted-foreground"> · Reconhecimento off</span>
                          )}
                        </p>
                      </div>

                      {/* Status badge */}
                      <div className="hidden md:flex items-center gap-2">
                        <span className={cn(
                          'text-[11px] font-medium px-2 py-0.5 rounded-md',
                          (student.azurePersonId || student.faceVector)
                            ? 'bg-foreground/[0.06] text-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {(student.azurePersonId || student.faceVector) ? 'Biometria OK' : 'Sem biometria'}
                        </span>
                      </div>

                      {/* Arrow + dropdown */}
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="flex h-8 w-8 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all"
                            >
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(student, 'info')}>
                              <Edit className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(student, 'photos')}>
                              <Camera className="h-4 w-4" /> Foto / biometria
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/admin/students/${student.id}/history`)}>
                              <Eye className="h-4 w-4" /> Ver histórico
                            </DropdownMenuItem>
                            {(student.azurePersonId || student.faceVector) && (
                              <DropdownMenuItem onClick={() => handleToggleRecognition(student)}>
                                <ScanFace className="h-4 w-4" />
                                {student.recognitionEnabled !== false ? 'Desativar reconhecimento' : 'Ativar reconhecimento'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onClick={() => handleDelete(student)}>
                              <Trash2 className="h-4 w-4" /> Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 hidden md:block" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <StudentDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingStudent(null); }}
        student={editingStudent}
        classes={classes}
        onSaved={handleSaved}
        defaultTab={dialogDefaultTab}
      />

      {/* Import CSV Dialog */}
      <Dialog open={importDialog} onOpenChange={(open) => { if (!open) setImportDialog(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Alunos</DialogTitle>
            <DialogDescription>
              Mapeie as colunas do seu arquivo. {csvRows.length} aluno{csvRows.length !== 1 ? 's' : ''} encontrado{csvRows.length !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Coluna do Nome *</Label>
                <select
                  value={nameCol}
                  onChange={(e) => setNameCol(Number(e.target.value))}
                  className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                >
                  {csvHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Coluna da Data de Nasc.</Label>
                <select
                  value={birthCol}
                  onChange={(e) => setBirthCol(Number(e.target.value))}
                  className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                >
                  <option value={-1}>Não importar</option>
                  {csvHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Pré-visualização</p>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/30">
                      <th className="text-left px-3 py-2 font-medium">Nome</th>
                      {birthCol >= 0 && <th className="text-left px-3 py-2 font-medium">Data Nasc.</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{row[nameCol] || <span className="text-muted-foreground italic">vazio</span>}</td>
                        {birthCol >= 0 && <td className="px-3 py-2">{row[birthCol] || '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmImport} loading={importing}>
              Importar {csvRows.filter(r => r[nameCol]?.trim()).length} alunos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
