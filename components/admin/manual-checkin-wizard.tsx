'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, LogIn, LogOut, Check, X, GraduationCap, Users, Clock,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toaster';
import { cn, getInitials } from '@/lib/utils';

interface ManualCheckinWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'grade' | 'class' | 'carousel' | 'success';

interface ClassItem {
  id: string;
  name: string;
  grade: string | null;
  _count: { students: number };
}

interface StudentItem {
  id: string;
  name: string;
  photoUrl: string | null;
  photos: { url: string; isProfile: boolean }[];
  class: { id: string; name: string; grade?: string | null };
}

export function ManualCheckinWizard({ open, onOpenChange }: ManualCheckinWizardProps) {
  const [step, setStep] = useState<Step>('grade');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [eventType, setEventType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [submitting, setSubmitting] = useState(false);
  const [lastRegistered, setLastRegistered] = useState<StudentItem | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('grade');
        setSelectedGrade('');
        setSelectedClass(null);
        setStudents([]);
        setCarouselIndex(0);
        setEventType('ENTRY');
        setLastRegistered(null);
        const now = new Date();
        setManualTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      }, 300);
    }
  }, [open]);

  // Load classes
  useEffect(() => {
    if (!open) return;
    fetch('/api/classes')
      .then((r) => r.json())
      .then(({ classes }) => setClasses(classes || []))
      .catch(() => {});
  }, [open]);

  // Unique grades
  const grades = Array.from(
    new Map(
      classes
        .filter((c) => c.grade)
        .map((c) => [c.grade, c])
    ).entries()
  ).map(([grade]) => grade as string).sort();

  // Classes for selected grade
  const gradeClasses = classes.filter((c) => c.grade === selectedGrade);

  // Load students when class selected
  const loadStudents = useCallback(async (classId: string) => {
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/classes/${classId}`);
      const data = await res.json();
      setStudents(data.class?.students || []);
      setCarouselIndex(0);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  function handleGradeSelect(grade: string) {
    setSelectedGrade(grade);
    const classesForGrade = classes.filter((c) => c.grade === grade);
    if (classesForGrade.length === 1) {
      // Skip class selection if only one class
      handleClassSelect(classesForGrade[0]);
    } else {
      setStep('class');
    }
  }

  function handleClassSelect(cls: ClassItem) {
    setSelectedClass(cls);
    loadStudents(cls.id);
    setStep('carousel');
  }

  async function handleRegister() {
    const student = students[carouselIndex];
    if (!student) return;
    setSubmitting(true);
    try {
      // Build timestamp from manualTime (HH:MM) + today's date
      const [hh, mm] = manualTime.split(':').map(Number);
      const ts = new Date();
      ts.setHours(hh, mm, 0, 0);

      const res = await fetch('/api/events/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, eventType, timestamp: ts.toISOString() }),
      });
      if (res.ok) {
        setLastRegistered(student);
        toast({
          variant: 'success',
          title: `${eventType === 'ENTRY' ? 'Entrada' : 'Saída'} registrada!`,
          description: student.name,
        });
        // Advance to next student after brief success
        setStep('success');
        setTimeout(() => {
          setStep('carousel');
          setLastRegistered(null);
          if (carouselIndex < students.length - 1) {
            setCarouselIndex((i) => i + 1);
          }
        }, 1000);
      } else {
        const data = await res.json();
        toast({ variant: 'destructive', title: 'Erro', description: data.error || 'Falha ao registrar.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function prev() { setCarouselIndex((i) => Math.max(0, i - 1)); }
  function next() { setCarouselIndex((i) => Math.min(students.length - 1, i + 1)); }

  const currentStudent = students[carouselIndex];
  const studentPhoto = currentStudent?.photos?.find((p) => p.isProfile)?.url
    || currentStudent?.photoUrl
    || null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showClose={false}
        className="h-[76vh] max-h-[76vh] !left-3 !right-3 !bottom-3 rounded-2xl border-0 shadow-xl p-0 flex flex-col overflow-hidden sm:!left-4 sm:!right-4 sm:!bottom-4"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 flex flex-row items-center gap-3 px-5 py-4 border-b border-border">
          {step !== 'grade' && (
            <button
              onClick={() => {
                if (step === 'class') setStep('grade');
                else if (step === 'carousel') setStep(gradeClasses.length === 1 ? 'grade' : 'class');
              }}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1">
            <SheetTitle className="text-base text-left">
              {step === 'grade' && 'Registrar Manualmente'}
              {step === 'class' && selectedGrade}
              {(step === 'carousel' || step === 'success') && selectedClass?.name}
            </SheetTitle>
            {step === 'carousel' && students.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {carouselIndex + 1} de {students.length} alunos
              </p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        {/* Body */}
        <div className={cn(
          'flex-1 min-h-0',
          (step === 'carousel' || step === 'success') ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        )}>

          {/* ── Step 1: Grade ── */}
          {step === 'grade' && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground mb-4">Selecione a série</p>
              {grades.length === 0 && classes.length === 0 && (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <GraduationCap className="h-10 w-10 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada</p>
                </div>
              )}
              {grades.length === 0 && classes.length > 0 && (
                // Classes without grade — show them directly
                <div className="grid grid-cols-2 gap-3">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => { setSelectedGrade(cls.name); handleClassSelect(cls); }}
                      className="group flex flex-col items-start gap-2 rounded-xl border border-border p-4 hover:bg-accent hover:border-foreground/10 transition-all text-left"
                    >
                      <Users className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-semibold">{cls.name}</p>
                        <p className="text-xs text-muted-foreground">{cls._count.students} alunos</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {grades.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {grades.map((grade) => {
                    const cnt = classes.filter((c) => c.grade === grade).reduce((s, c) => s + c._count.students, 0);
                    return (
                      <button
                        key={grade}
                        onClick={() => handleGradeSelect(grade)}
                        className="group flex flex-col items-start gap-2 rounded-xl border border-border p-4 hover:bg-accent hover:border-foreground/10 transition-all text-left"
                      >
                        <GraduationCap className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm font-semibold">{grade}</p>
                          <p className="text-xs text-muted-foreground">{cnt} alunos</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Class ── */}
          {step === 'class' && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground mb-4">Selecione a turma</p>
              <div className="grid grid-cols-2 gap-3">
                {gradeClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => handleClassSelect(cls)}
                    className="group flex flex-col items-start gap-2 rounded-xl border border-border p-4 hover:bg-accent hover:border-foreground/10 transition-all text-left"
                  >
                    <Users className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
                    <div>
                      <p className="text-sm font-semibold">{cls.name}</p>
                      <p className="text-xs text-muted-foreground">{cls._count.students} alunos</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Carousel ── */}
          {(step === 'carousel' || step === 'success') && (
            <div className="relative flex-1 min-h-0">
              {loadingStudents ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
                </div>
              ) : students.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8">
                  <GraduationCap className="h-10 w-10 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Nenhum aluno nesta turma</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col">
                  {/* Student Card */}
                  <div className="flex-1 flex flex-col items-center justify-center px-6 pb-2 relative">
                    {/* Arrows */}
                    <button
                      onClick={prev}
                      disabled={carouselIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-border flex items-center justify-center hover:bg-accent disabled:opacity-20 transition-all"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={next}
                      disabled={carouselIndex === students.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-border flex items-center justify-center hover:bg-accent disabled:opacity-20 transition-all"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {/* Success overlay */}
                    {step === 'success' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl z-10">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                            <Check className="h-8 w-8 text-success" />
                          </div>
                          <p className="text-sm font-medium">{eventType === 'ENTRY' ? 'Entrada' : 'Saída'} registrada!</p>
                        </div>
                      </div>
                    )}

                    {/* Photo */}
                    <div className="relative mb-4">
                      <Avatar className="h-28 w-28 border-2 border-border/30">
                        <AvatarImage
                          src={studentPhoto || ''}
                          alt={currentStudent?.name}
                          className="object-cover"
                        />
                        <AvatarFallback className="text-4xl font-light text-muted-foreground bg-secondary">
                          {currentStudent ? getInitials(currentStudent.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Name + class */}
                    <h2 className="text-xl font-semibold text-center tracking-tight leading-tight mb-1">
                      {currentStudent?.name}
                    </h2>
                    <p className="text-sm text-muted-foreground text-center mb-2">
                      {currentStudent?.class?.grade && `${currentStudent.class.grade} · `}
                      {currentStudent?.class?.name}
                    </p>

                    {/* Dot indicators */}
                    <div className="flex items-center gap-1 mt-2">
                      {students.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCarouselIndex(i)}
                          className={cn(
                            'rounded-full transition-all',
                            i === carouselIndex
                              ? 'w-4 h-1.5 bg-foreground'
                              : 'w-1.5 h-1.5 bg-muted-foreground/30'
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Time + Entry/Exit + Register */}
                  <div className="px-5 pb-8 space-y-3 flex-shrink-0">
                    {/* Time picker */}
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="time"
                        value={manualTime}
                        onChange={(e) => setManualTime(e.target.value)}
                        className="h-9 rounded-xl border border-input bg-card px-3 text-sm font-medium text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring/40"
                      />
                    </div>

                    {/* Toggle */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setEventType('ENTRY')}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all',
                          eventType === 'ENTRY'
                            ? 'border-foreground/20 bg-accent text-foreground'
                            : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
                        )}
                      >
                        <LogIn className={cn('h-4 w-4', eventType === 'ENTRY' && 'text-success')} />
                        Entrada
                      </button>
                      <button
                        onClick={() => setEventType('EXIT')}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all',
                          eventType === 'EXIT'
                            ? 'border-foreground/20 bg-accent text-foreground'
                            : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
                        )}
                      >
                        <LogOut className="h-4 w-4" />
                        Saída
                      </button>
                    </div>

                    <Button
                      className="w-full h-12 text-base"
                      onClick={handleRegister}
                      loading={submitting}
                      disabled={!currentStudent || step === 'success'}
                    >
                      {eventType === 'ENTRY' ? (
                        <><LogIn className="h-4 w-4" /> Registrar Entrada</>
                      ) : (
                        <><LogOut className="h-4 w-4" /> Registrar Saída</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
