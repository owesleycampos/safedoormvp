'use client';

import { useState, useTransition } from 'react';
import {
  UserPlus, Search, MoreHorizontal, Edit, Trash2,
  Camera, Users, GraduationCap, Eye,
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
import { StudentDialog } from '@/components/admin/student-dialog';
import { toast } from '@/components/ui/toaster';
import { cn, getInitials } from '@/lib/utils';

interface StudentsClientProps {
  students: any[];
  classes: any[];
}

export function StudentsClient({ students: initialStudents, classes }: StudentsClientProps) {
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.class?.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.registration || '').includes(search);
    const matchClass = filterClass === 'all' || s.classId === filterClass;
    return matchSearch && matchClass;
  });

  function handleEdit(student: any) {
    setEditingStudent(student);
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

  const byClass: Record<string, any[]> = {};
  filtered.forEach((s) => {
    const cls = s.class?.name || 'Sem turma';
    if (!byClass[cls]) byClass[cls] = [];
    byClass[cls].push(s);
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
          >
            <option value="all">Todas as turmas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <Button
          onClick={() => { setEditingStudent(null); setDialogOpen(true); }}
          size="sm"
          className="gap-1.5"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Novo Aluno
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{filtered.length} alunos</span>
        <span>·</span>
        <span>{classes.length} turmas</span>
        <span>·</span>
        <span>{students.filter((s) => s.faceVector).length} com biometria</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GraduationCap className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byClass).sort(([a], [b]) => a.localeCompare(b)).map(([className, classStudents]) => (
            <div key={className}>
              {/* Class header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {className}
                </span>
                <span className="text-xs text-muted-foreground">({classStudents.length})</span>
              </div>

              <Card className="overflow-hidden">
                <div className="divide-y divide-border">
                  {classStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 px-4 py-3 table-row-hover group"
                    >
                      {/* Avatar with biometry dot */}
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={student.photos?.[0]?.url || student.photoUrl || ''}
                            alt={student.name}
                          />
                          <AvatarFallback className="text-[11px] bg-secondary">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                          student.faceVector ? 'bg-success' : 'bg-muted-foreground/40'
                        )} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{student.name}</p>
                          {!student.isActive && (
                            <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {student.photos?.length > 0 ? `${student.photos.length} foto${student.photos.length !== 1 ? 's' : ''} · ` : ''}
                          {student.parents?.length || 0} responsável(is)
                        </p>
                      </div>

                      {/* Biometry badge */}
                      <div className="hidden md:block">
                        <Badge variant={student.faceVector ? 'success' : 'warning'}>
                          {student.faceVector ? 'Biometria OK' : 'Sem biometria'}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(student)}>
                            <Edit className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Camera className="h-4 w-4" />
                            Foto / biometria
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4" />
                            Ver histórico
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onClick={() => handleDelete(student)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <StudentDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingStudent(null); }}
        student={editingStudent}
        classes={classes}
        onSaved={handleSaved}
      />
    </div>
  );
}
