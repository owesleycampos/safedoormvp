'use client';

import { useState } from 'react';
import {
  Plus, Search, GraduationCap, Edit, Trash2, Users, MoreHorizontal,
  Send, Copy, Check, Link2, Loader2, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

interface ClassItem {
  id: string;
  name: string;
  grade: string | null;
  _count: { students: number };
  createdAt?: Date | string;
}

interface ClassesClientProps {
  classes: ClassItem[];
  schoolId: string;
}

const GRADE_OPTIONS = [
  'Educação Infantil',
  '1º Ano',
  '2º Ano',
  '3º Ano',
  '4º Ano',
  '5º Ano',
  '6º Ano',
  '7º Ano',
  '8º Ano',
  '9º Ano',
  '1º Ano EM',
  '2º Ano EM',
  '3º Ano EM',
];

const EMPTY_FORM = { name: '', grade: '' };

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

  const filtered = classes.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.grade ?? '').toLowerCase().includes(q)
    );
  });

  // Group by grade
  const byGrade: Record<string, ClassItem[]> = {};
  filtered.forEach((c) => {
    const grade = c.grade || 'Sem série';
    if (!byGrade[grade]) byGrade[grade] = [];
    byGrade[grade].push(c);
  });

  function openCreate() {
    setEditingClass(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(cls: ClassItem) {
    setEditingClass(cls);
    setForm({ name: cls.name, grade: cls.grade ?? '' });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingClass(null);
    setForm(EMPTY_FORM);
  }

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
          body: JSON.stringify({ name: form.name, grade: form.grade || null }),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated: ClassItem = await res.json();
        setClasses((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );
        toast({ variant: 'success', title: 'Turma atualizada', description: updated.name });
      } else {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, grade: form.grade || null }),
        });
        if (!res.ok) throw new Error(await res.text());
        const created: ClassItem & { _count?: { students: number } } = await res.json();
        setClasses((prev) => [{ ...created, _count: { students: 0 } }, ...prev]);
        toast({ variant: 'success', title: 'Turma criada', description: created.name });
      }
      closeDialog();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(cls: ClassItem) {
    if (cls._count.students > 0) {
      toast({
        variant: 'warning',
        title: 'Turma com alunos',
        description: `Mova os ${cls._count.students} aluno(s) antes de excluir.`,
      });
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
        const link = `${window.location.origin}/vincular/${data.invite.token}`;
        setInviteLink(link);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: data.error });
        setInviteDialog(null);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao gerar convite' });
      setInviteDialog(null);
    } finally {
      setInviteLoading(false);
    }
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
    const msg = encodeURIComponent(getWhatsAppMessage());
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  function handleCopyWhatsAppMessage() {
    navigator.clipboard.writeText(getWhatsAppMessage());
    toast({ variant: 'success', title: 'Mensagem copiada! Cole no WhatsApp.' });
  }

  const totalStudents = classes.reduce((sum, c) => sum + c._count.students, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: GraduationCap, value: classes.length,      label: 'Turmas'         },
          { icon: Users,         value: totalStudents,        label: 'Alunos no total'},
          { icon: GraduationCap, value: classes.length > 0 ? Math.round(totalStudents / classes.length) : 0, label: 'Média por turma' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar turma ou série..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
          className="max-w-xs"
        />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova Turma
        </Button>
      </div>

      {/* Classes grouped by grade */}
      {Object.keys(byGrade).length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">Nenhuma turma encontrada</p>
          <p className="text-sm text-muted-foreground">
            {search ? 'Tente outros termos de busca.' : 'Crie sua primeira turma para começar.'}
          </p>
          {!search && (
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Nova Turma
            </Button>
          )}
        </Card>
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
          .map(([grade, gradeClasses]) => (
            <div key={grade} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {grade}
                </h2>
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground">
                  {gradeClasses.length} turma{gradeClasses.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {gradeClasses.map((cls) => (
                  <Card
                    key={cls.id}
                    className="group relative overflow-hidden hover:border-border transition-all duration-200"
                  >
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-200" />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="h-9 w-9 rounded-md border border-border flex items-center justify-center">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(cls)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerateInvite(cls.id, cls.name)}>
                              <Send className="h-4 w-4 mr-2" />
                              Enviar Convite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(cls)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardTitle className="text-base mb-1">{cls.name}</CardTitle>
                      {cls.grade && (
                        <p className="text-xs text-muted-foreground mb-3">{cls.grade}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="default" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {cls._count.students} aluno{cls._count.students !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
      )}

      {/* Invite Dialog */}
      <Dialog open={!!inviteDialog} onOpenChange={(open) => { if (!open) setInviteDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convite para Pais</DialogTitle>
            <DialogDescription>
              Compartilhe o link abaixo com os responsáveis da turma{' '}
              <strong>{inviteDialog?.className}</strong>. Cada pai seleciona seu filho e confirma com a data de nascimento.
            </DialogDescription>
          </DialogHeader>

          {inviteLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : inviteLink ? (
            <div className="space-y-4 mt-2">
              {/* Link display */}
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-input bg-secondary/50 px-3 py-2 text-xs text-muted-foreground truncate font-mono">
                  {inviteLink}
                </div>
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={handleShareWhatsApp} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Send className="h-4 w-4" />
                  Enviar via WhatsApp
                </Button>
                <Button variant="outline" onClick={handleCopyWhatsAppMessage} className="w-full gap-2">
                  <Copy className="h-4 w-4" />
                  Copiar mensagem completa
                </Button>
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
              {editingClass
                ? 'Atualize o nome ou série da turma.'
                : 'Preencha as informações da nova turma.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="class-name">Nome da Turma *</Label>
              <Input
                id="class-name"
                placeholder="Ex: 3º Ano A"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-grade">Série</Label>
              <select
                id="class-grade"
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                className="w-full h-11 rounded-md border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              >
                <option value="">Selecionar série...</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {editingClass ? 'Salvar alterações' : 'Criar turma'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
