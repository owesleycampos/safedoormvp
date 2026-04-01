'use client';

import { useState } from 'react';
import {
  Plus, Search, Mail, Phone, Users, MoreHorizontal, Edit, Trash2,
  UserCheck, Shield, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
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
import { cn, getInitials, formatDate, formatRelativeTime } from '@/lib/utils';

interface ParentStudent {
  studentId: string;
  parentId: string;
  relationship: string;
  isPrimary: boolean;
  student: {
    id: string;
    name: string;
    class: { name: string } | null;
  };
}

interface ParentItem {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  user: {
    id: string;
    email: string;
    image: string | null;
    createdAt: Date | string;
  };
  students: ParentStudent[];
}

interface ParentsClientProps {
  parents: ParentItem[];
  schoolId: string;
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  password: '',
};

export function ParentsClient({ parents: initialParents, schoolId }: ParentsClientProps) {
  const [parents, setParents] = useState<ParentItem[]>(initialParents);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailParent, setDetailParent] = useState<ParentItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<ParentItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const filtered = parents.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.user.email.toLowerCase().includes(q) ||
      (p.phone ?? '').includes(q) ||
      p.students.some((sp) => sp.student.name.toLowerCase().includes(q))
    );
  });

  function openCreate() {
    setEditingParent(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(parent: ParentItem) {
    setEditingParent(parent);
    setForm({
      name: parent.name,
      email: parent.user.email,
      phone: parent.phone ?? '',
      cpf: parent.cpf ?? '',
      password: '',
    });
    setDialogOpen(true);
  }

  function openDetail(parent: ParentItem) {
    setDetailParent(parent);
    setDetailOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingParent(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast({ variant: 'warning', title: 'Campos obrigatórios', description: 'Nome e e-mail são obrigatórios.' });
      return;
    }
    setLoading(true);
    try {
      if (editingParent) {
        const res = await fetch(`/api/parents/${editingParent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone || null,
            cpf: form.cpf || null,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated: ParentItem = await res.json();
        setParents((prev) =>
          prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
        );
        toast({ variant: 'success', title: 'Responsável atualizado', description: updated.name });
      } else {
        const res = await fetch('/api/parents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            cpf: form.cpf || null,
            password: form.password,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const created: ParentItem = await res.json();
        setParents((prev) => [{ ...created, students: [] }, ...prev]);
        toast({ variant: 'success', title: 'Responsável criado', description: created.name });
      }
      closeDialog();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(parent: ParentItem) {
    if (parent.students.length > 0) {
      toast({
        variant: 'warning',
        title: 'Responsável vinculado',
        description: `Desvincule os ${parent.students.length} aluno(s) antes de excluir.`,
      });
      return;
    }
    if (!confirm(`Excluir responsável "${parent.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`/api/parents/${parent.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setParents((prev) => prev.filter((p) => p.id !== parent.id));
      toast({ variant: 'success', title: 'Responsável excluído', description: parent.name });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err.message });
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-secondary flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">{parents.length}</p>
            <p className="text-sm text-muted-foreground">Responsáveis</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {parents.reduce((s, p) => s + p.students.length, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Vínculos ativos</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-warn/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-warn" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {parents.filter((p) => p.students.some((sp) => sp.isPrimary)).length}
            </p>
            <p className="text-sm text-muted-foreground">Responsáveis primários</p>
          </div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar por nome, e-mail ou aluno..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
          className="max-w-sm"
        />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo Responsável
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center">
            <UserCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">Nenhum responsável encontrado</p>
          <p className="text-sm text-muted-foreground">
            {search ? 'Tente outros termos de busca.' : 'Cadastre o primeiro responsável.'}
          </p>
          {!search && (
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Novo Responsável
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/50">
            {filtered.map((parent) => (
              <div
                key={parent.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors group"
              >
                {/* Avatar */}
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={parent.user.image ?? undefined} alt={parent.name} />
                  <AvatarFallback className="bg-secondary text-foreground font-semibold text-sm">
                    {getInitials(parent.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{parent.name}</p>
                    {parent.students.some((sp) => sp.isPrimary) && (
                      <Badge variant="success" className="text-xs shrink-0">Primário</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {parent.user.email}
                    </span>
                    {parent.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {parent.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Students count */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <div className="flex -space-x-2">
                    {parent.students.slice(0, 3).map((sp) => (
                      <div
                        key={sp.studentId}
                        className="h-7 w-7 rounded-full bg-secondary border-2 border-background flex items-center justify-center"
                        title={sp.student.name}
                      >
                        <span className="text-[10px] font-semibold text-foreground">
                          {getInitials(sp.student.name)}
                        </span>
                      </div>
                    ))}
                    {parent.students.length > 3 && (
                      <div className="h-7 w-7 rounded-full bg-secondary border-2 border-background flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          +{parent.students.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {parent.students.length} aluno{parent.students.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Joined */}
                <div className="hidden lg:block text-xs text-muted-foreground shrink-0">
                  Desde {formatDate(parent.user.createdAt)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => openDetail(parent)}
                    title="Ver detalhes"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(parent)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(parent)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingParent ? 'Editar Responsável' : 'Novo Responsável'}</DialogTitle>
            <DialogDescription>
              {editingParent
                ? 'Atualize os dados do responsável.'
                : 'Preencha os dados para criar um novo acesso de responsável.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="parent-name">Nome completo *</Label>
                <Input
                  id="parent-name"
                  placeholder="Ex: Maria Silva"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="parent-email">E-mail *</Label>
                <Input
                  id="parent-email"
                  type="email"
                  placeholder="responsavel@email.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={!!editingParent}
                />
                {editingParent && (
                  <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent-phone">Telefone</Label>
                <Input
                  id="parent-phone"
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent-cpf">CPF</Label>
                <Input
                  id="parent-cpf"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="parent-password">
                  {editingParent ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
                </Label>
                <Input
                  id="parent-password"
                  type="password"
                  placeholder={editingParent ? '••••••••' : 'Mínimo 8 caracteres'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {editingParent ? 'Salvar alterações' : 'Criar responsável'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          {detailParent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={detailParent.user.image ?? undefined} />
                    <AvatarFallback className="bg-secondary text-foreground font-semibold">
                      {getInitials(detailParent.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{detailParent.name}</DialogTitle>
                    <DialogDescription>{detailParent.user.email}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Contact info */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{detailParent.user.email}</span>
                    </div>
                    {detailParent.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{detailParent.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked students */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Alunos vinculados ({detailParent.students.length})
                  </p>
                  {detailParent.students.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum aluno vinculado.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailParent.students.map((sp) => (
                        <div
                          key={sp.studentId}
                          className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                              <span className="text-xs font-semibold text-foreground">
                                {getInitials(sp.student.name)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{sp.student.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {sp.student.class?.name ?? 'Sem turma'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={sp.isPrimary ? 'success' : 'outline'} className="text-xs">
                              {sp.relationship}
                            </Badge>
                            {sp.isPrimary && (
                              <Badge variant="success" className="text-xs">Primário</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Cadastrado em {formatDate(detailParent.user.createdAt)}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
                <Button onClick={() => { setDetailOpen(false); openEdit(detailParent); }}>
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
