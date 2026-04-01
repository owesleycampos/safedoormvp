'use client';

import { useState, useEffect } from 'react';
import { Search, LogIn, LogOut, UserCheck, Check } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toaster';
import { cn, getInitials } from '@/lib/utils';

interface ManualCheckinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualCheckinDialog({ open, onOpenChange }: ManualCheckinDialogProps) {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [eventType, setEventType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch(''); setStudents([]); setSelectedStudent(null);
      setEventType('ENTRY'); setSuccess(false);
    }
  }, [open]);

  useEffect(() => {
    if (search.length < 2) { setStudents([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(search)}&limit=8`);
        const data = await res.json();
        setStudents(data.students || []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function handleSubmit() {
    if (!selectedStudent) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/events/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.id, eventType }),
      });
      if (res.ok) {
        setSuccess(true);
        toast({
          variant: 'success',
          title: 'Registro realizado!',
          description: `${selectedStudent.name} — ${eventType === 'ENTRY' ? 'Entrada' : 'Saída'}`,
        });
        setTimeout(() => onOpenChange(false), 1200);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            Registro Manual
          </DialogTitle>
          <DialogDescription>
            Busque o aluno e registre entrada ou saída.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8 text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-success" />
            </div>
            <p className="text-sm font-medium">Registro realizado!</p>
            <p className="text-xs text-muted-foreground">{selectedStudent?.name}</p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedStudent(null); }}
                className="pl-8"
                autoFocus
              />
            </div>

            {/* Results */}
            {!selectedStudent && students.length > 0 && (
              <div className="rounded-md border border-border overflow-hidden divide-y divide-border">
                {students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedStudent(s); setStudents([]); setSearch(''); }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={s.photoUrl || ''} />
                      <AvatarFallback className="text-[10px] bg-secondary">{getInitials(s.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.class?.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
              </div>
            )}

            {/* Selected Student */}
            {selectedStudent && (
              <div className="rounded-md border border-border bg-secondary/30 p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={selectedStudent.photoUrl || ''} />
                  <AvatarFallback className="text-xs bg-secondary">{getInitials(selectedStudent.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedStudent.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedStudent.class?.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Trocar
                </button>
              </div>
            )}

            {/* Event Type */}
            {selectedStudent && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEventType('ENTRY')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-md border p-2.5 text-sm font-medium transition-colors',
                    eventType === 'ENTRY'
                      ? 'border-border bg-accent text-foreground'
                      : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                  )}
                >
                  <LogIn className={cn('h-4 w-4', eventType === 'ENTRY' ? 'text-success' : '')} />
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setEventType('EXIT')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-md border p-2.5 text-sm font-medium transition-colors',
                    eventType === 'EXIT'
                      ? 'border-border bg-accent text-foreground'
                      : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Saída
                </button>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!selectedStudent}
              className="w-full"
            >
              {eventType === 'ENTRY' ? (
                <><LogIn className="h-4 w-4" /> Registrar Entrada</>
              ) : (
                <><LogOut className="h-4 w-4" /> Registrar Saída</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
