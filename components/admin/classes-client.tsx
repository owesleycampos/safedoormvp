'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Search, GraduationCap, Edit, Trash2, Users, MoreHorizontal,
  Send, Copy, Check, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

interface ClassItem {
  id: string;
  name: string;
  grade: string | null;
  shift: string | null;
  _count: { students: number };
  createdAt?: Date | string;
}

const SHIFT_OPTIONS = [
  { value: 'MANHA', label: 'Manhã' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'NOITE', label: 'Noite' },
  { value: 'INTEGRAL', label: 'Integral' },
];

function shiftLabel(shift: string | null): string {
  return SHIFT_OPTIONS.find(s => s.value === shift)?.label || '';
}

interface ClassesClientProps {
  classes: ClassItem[];
  schoolId: string;
}

const GRADE_OPTIONS = [
  'Educação Infantil',
  '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano',
  '6º Ano', '7º Ano', '8º Ano', '9º Ano',
  '1º Ano EM', '2º Ano EM', '3º Ano EM',
];

const EMPTY_FORM = { name: '', grade: '', shift: '' };

export function ClassesClient({ classes: initialClasses, schoolId }: ClassesClientProps) {
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [inviteDialog, setInviteDialog] = useState<{ classId: string; className: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, { present: number; total: number }>>({});

  // Fetch today's attendance per class
  useEffect(() => {
    async function fetchAttendance() {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/reports/attendance?from=${todayStr}&to=${todayStr}`);
        if (!res.ok) return;
        const data = await res.json();
        const rows = data.rows ?? [];
        // Group by className -> map to classId using our classes list
        const byClassName: Record<string, { present: number; total: number }> = {};
        rows.forEach((r: any) => {
          const status = r.attendance?.[todayStr];
          if (!status || status === 'weekend') return;
          if (!byClassName[r.className]) byClassName[r.className] = { present: 0, total: 0 };
          byClassName[r.className].total++;
          if (status === 'present' || status === 'late') byClassName[r.className].present++;
        });
        // Map className to classId
        const byId: Record<string, { present: number; total: number }> = {};
        initialClasses.forEach(c => {
          if (byClassName[c.name]) byId[c.id] = byClassName[c.name];
        });
        setAttendance(byId);
      } catch { /* silent */ }
    }
    fetchAttendance();
  }, []);

  const filtered = classes.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.grade ?? '').toLowerCase().includes(q);
  });

  const byGrade: Record<string, ClassItem[]> = {};
  filtered.forEach((c) => {
    const grade = c.grade || 'Sem série';
    if (!byGrade[grade]) byGrade[grade] = [];
    byGrade[grade].push(c);
  });

  function openCreate() { setEditingClass(null); setForm(EMPTY_FORM); setDialogOpen(true); }
  function openEdit(cls: ClassItem) {
    setEditingClass(cls);
    setForm({ name: cls.name, grade: cls.grade ?? '', shift: cls.shift ?? '' });
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditingClass(null); setForm(EMPTY_FORM); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: 'warning', title: 'Nome obrigatório', description: 'Informe o nome da turma.' });
      return;
    }
    setLoading(true);
    try {
      if (editingClass) {
        const res = await fetch(`/api/classes/${editingClass.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, grade: form.grade || null, shift: form.shift || null }),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated: ClassItem = await res.json();
        setClasses((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
        toast({ variant: 'success', title: 'Turma atualizada', description: updated.name });
      } else {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, grade: form.grade || null, shift: form.shift || null }),
        });
        if (!res.ok) throw new Error(await res.text());
        const created: ClassItem & { _count?: { students: number } } = await res.json();
        setClasses((prev) => [{ ...created, _count: { students: 0 } }, ...prev]);
        toast({ variant: 'success', title: 'Turma criada', description: created.name });
      }
      closeDialog();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Tente novamente.' });
    } finally { setLoading(false); }
  }

  async function handleDelete(cls: ClassItem) {
    if (cls._count.students > 0) {
      toast({ variant: 'warning', title: 'Turma com alunos', description: `Mova os ${cls._count.students} aluno(s) antes de excluir.` });
      return;
    }
    if (!confirm(`Excluir turma "${cls.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`/api/classes/${cls.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setClasses((prev) => prev.filter((c) => c.id !== cls.id));
      toast({ variant: 'success', title: 'Turma excluída', description: cls.name });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err.message });
    }
  }

  async function handleGenerateInvite(classId: string, className: string) {
    setInviteDialog({ classId, className });
    setInviteLink(null);
    setCopied(false);
    setInviteLoading(true);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteLink(`${window.location.origin}/vincular/${data.invite.token}`);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: data.error });
        setInviteDialog(null);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao gerar convite' });
      setInviteDialog(null);
    } finally { setInviteLoading(false); }
  }

  function getWhatsAppMessage() {
    if (!inviteLink || !inviteDialog) return '';
    return `Olá! A escola disponibilizou o link abaixo para você vincular seu filho(a) da turma *${inviteDialog.className}* ao sistema Safe Door.\n\nAcesse o link e siga as instruções:\n${inviteLink}\n\nCom o Safe Door você acompanha a entrada e saída do seu filho em tempo real.`;
  }

  function handleCopyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ variant: 'success', title: 'Link copiado!' });
  }

  function handleShareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(getWhatsAppMessage())}`, '_blank');
  }

  function handleCopyWhatsAppMessage() {
    navigator.clipboard.writeText(getWhatsAppMessage());
    toast({ variant: 'success', title: 'Mensagem copiada! Cole no WhatsApp.' });
  }

  const totalStudents = classes.reduce((sum, c) => sum + c._count.students, 0);

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
            <h1 className="text-xl font-semibold tracking-tight">Turmas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {classes.length} turma{classes.length !== 1 ? 's' : ''} · {totalStudents} aluno{totalStudents !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Turma
          </button>
        </motion.div>

        {/* KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { value: classes.length, label: 'Turmas' },
            { value: totalStudents, label: 'Alunos no total' },
            { value: classes.length > 0 ? Math.round(totalStudents / classes.length) : 0, label: 'Média por turma' },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <span className="text-[11px] text-muted-foreground">{stat.label}</span>
              <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{stat.value}</p>
            </Card>
          ))}
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Input
            placeholder="Buscar turma ou série..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="max-w-xs"
          />
        </motion.div>

        {/* Classes grouped by grade */}
        {Object.keys(byGrade).length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
          >
            <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
              <GraduationCap className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
              <p className="text-sm font-semibold">Nenhuma turma encontrada</p>
              <p className="text-xs text-muted-foreground">
                {search ? 'Tente outros termos de busca.' : 'Crie sua primeira turma para começar.'}
              </p>
              {!search && (
                <button
                  onClick={openCreate}
                  className="mt-2 flex items-center gap-2 h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova Turma
                </button>
              )}
            </Card>
          </motion.div>
        ) : (
          Object.entries(byGrade)
            .sort(([a], [b]) => {
              const iA = GRADE_OPTIONS.indexOf(a);
              const iB = GRADE_OPTIONS.indexOf(b);
              if (iA === -1 && iB === -1) return a.localeCompare(b);
              if (iA === -1) return 1;
              if (iB === -1) return -1;
              return iA - iB;
            })
            .map(([grade, gradeClasses], gi) => (
              <motion.div
                key={grade}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.15 + gi * 0.04 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {grade}
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {gradeClasses.length} turma{gradeClasses.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {gradeClasses.map((cls) => (
                    <Card
                      key={cls.id}
                      className="group relative p-4 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="h-8 w-8 rounded-md border border-border flex items-center justify-center">
                          <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-all">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(cls)}>
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerateInvite(cls.id, cls.name)}>
                              <Send className="h-4 w-4 mr-2" /> Enviar Convite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(cls)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-sm font-semibold">{cls.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[cls.grade, shiftLabel(cls.shift)].filter(Boolean).join(' · ') || 'Sem série'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-3">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {cls._count.students} aluno{cls._count.students !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {attendance[cls.id] && attendance[cls.id].total > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
                          <span className="text-[10px] text-muted-foreground">
                            {attendance[cls.id].present}/{attendance[cls.id].total} presentes hoje
                          </span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </motion.div>
            ))
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={!!inviteDialog} onOpenChange={(open) => { if (!open) setInviteDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convite para Pais</DialogTitle>
            <DialogDescription>
              Compartilhe o link com os responsáveis da turma{' '}
              <strong>{inviteDialog?.className}</strong>.
            </DialogDescription>
          </DialogHeader>

          {inviteLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : inviteLink ? (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground truncate font-mono">
                  {inviteLink}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="flex items-center justify-center gap-2 h-9 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar via WhatsApp
                </button>
                <button
                  onClick={handleCopyWhatsAppMessage}
                  className="flex items-center justify-center gap-2 h-9 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar mensagem completa
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                O link expira em 30 dias. Gerar um novo convite invalida o anterior.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClass ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
            <DialogDescription>
              {editingClass ? 'Atualize as informações da turma.' : 'Preencha as informações da nova turma.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="class-name">Nome da Turma *</Label>
              <Input id="class-name" placeholder="Ex: 3º Ano A" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-grade">Série</Label>
              <select id="class-grade" value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none text-foreground"
              >
                <option value="">Selecionar série...</option>
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-shift">Turno</Label>
              <select id="class-shift" value={form.shift}
                onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none text-foreground"
              >
                <option value="">Selecionar turno...</option>
                {SHIFT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>Cancelar</Button>
              <Button type="submit" loading={loading}>
                {editingClass ? 'Salvar alterações' : 'Criar turma'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
