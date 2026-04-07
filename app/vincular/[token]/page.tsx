'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Search, Loader2, CheckCircle2, AlertCircle, ArrowLeft,
  GraduationCap, Shield, Users, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  photoUrl: string | null;
}

interface InviteData {
  school: { name: string; logoUrl: string | null };
  class: { id: string; name: string; grade: string | null };
  students: Student[];
  expiresAt: string;
}

interface ClaimResult {
  success?: boolean;
  alreadyLinked?: boolean;
  message?: string;
  error?: string;
  needsAccount?: boolean;
  hasMoreStudents?: boolean;
  student?: { name: string; className: string };
}

type Step = 'select' | 'confirm' | 'account' | 'success';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VincularPage() {
  const { token } = useParams<{ token: string }>();

  // Data
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow state
  const [step, setStep] = useState<Step>('select');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Confirm form
  const [birthDate, setBirthDate] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');

  // Account form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);

  // ── Fetch invite data ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/invites/${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'Link inválido ou expirado.');
          return;
        }
        setInvite(await res.json());
      } catch {
        setError('Erro ao carregar. Verifique sua conexão.');
      } finally {
        setLoadingInvite(false);
      }
    }
    load();
  }, [token]);

  // ── Filtered & sorted students ──
  const filteredStudents = useMemo(() => {
    if (!invite) return [];
    const q = search.toLowerCase().trim();
    return invite.students
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [invite, search]);

  // ── Select student ──
  function handleSelect(student: Student) {
    setSelectedStudent(student);
    setStep('confirm');
  }

  // ── Submit claim ──
  async function handleClaim(needsAccount = false) {
    if (!selectedStudent) return;
    setSubmitting(true);

    try {
      const body: Record<string, string> = {
        studentId: selectedStudent.id,
        birthDate,
        parentName,
        phone,
      };
      if (needsAccount || email) {
        body.email = email;
        body.password = password;
      }

      const res = await fetch(`/api/invites/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: ClaimResult = await res.json();

      if (data.needsAccount) {
        setStep('account');
        return;
      }

      setResult(data);
      if (data.success) {
        setStep('success');
      }
    } catch {
      setResult({ error: 'Erro de conexão. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Link another student ──
  function handleLinkAnother() {
    setSelectedStudent(null);
    setBirthDate('');
    setResult(null);
    setStep('select');
  }

  // ── Loading state ──
  if (loadingInvite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // ── Error state ──
  if (error || !invite) {
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Link Inválido</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {error || 'Este link de convite não é válido ou já expirou.'}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Entre em contato com a escola para obter um novo link.
        </p>
      </Card>
    );
  }

  // ─── STEP: Select Student ────────────────────────────────────────────────────

  if (step === 'select') {
    return (
      <div className="space-y-4">
        {/* School info */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">{invite.school.name}</h1>
              <p className="text-xs text-muted-foreground">
                {invite.class.name}
                {invite.class.grade ? ` — ${invite.class.grade}` : ''}
              </p>
            </div>
          </div>
        </Card>

        <div>
          <h2 className="text-sm font-semibold mb-1">Selecione seu filho(a)</h2>
          <p className="text-xs text-muted-foreground">
            Encontre o nome do aluno na lista abaixo para vincular à sua conta.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Student list */}
        <Card className="overflow-hidden">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? 'Nenhum aluno encontrado com esse nome.' : 'Nenhum aluno nesta turma.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleSelect(student)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 active:bg-accent transition-colors text-left"
                >
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    {student.photoUrl && <AvatarImage src={student.photoUrl} alt={student.name} />}
                    <AvatarFallback className="text-xs bg-secondary">
                      {getInitials(student.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm font-medium truncate">{student.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </Card>

        <p className="text-[11px] text-muted-foreground text-center">
          {invite.students.length} aluno{invite.students.length !== 1 ? 's' : ''} nesta turma
        </p>
      </div>
    );
  }

  // ─── STEP: Confirm with birth date ──────────────────────────────────────────

  if (step === 'confirm') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setStep('select')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-11 w-11">
              {selectedStudent?.photoUrl && (
                <AvatarImage src={selectedStudent.photoUrl} alt={selectedStudent.name} />
              )}
              <AvatarFallback className="bg-secondary">
                {getInitials(selectedStudent?.name || '')}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{selectedStudent?.name}</p>
              <p className="text-xs text-muted-foreground">
                {invite.class.name}
                {invite.class.grade ? ` — ${invite.class.grade}` : ''}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium">Confirme seus dados</p>
            <p className="text-xs text-muted-foreground">
              Para sua segurança, confirme a data de nascimento do aluno.
            </p>

            <div className="space-y-2">
              <Label htmlFor="parentName">Seu nome completo *</Label>
              <Input
                id="parentName"
                placeholder="Nome do responsável"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (WhatsApp)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Data de nascimento do aluno *</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            {result?.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                {result.error}
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => handleClaim()}
              disabled={!parentName.trim() || !birthDate || submitting}
              loading={submitting}
            >
              Confirmar e Vincular
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── STEP: Create Account ───────────────────────────────────────────────────

  if (step === 'account') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setStep('confirm')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <Card className="p-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Criar sua conta</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Para acompanhar a frequência do seu filho(a), crie uma conta com e-mail e senha.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {result?.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                {result.error}
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => handleClaim(true)}
              disabled={!email.trim() || password.length < 6 || submitting}
              loading={submitting}
            >
              Criar Conta e Vincular
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── STEP: Success ──────────────────────────────────────────────────────────

  if (step === 'success' && result) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              {result.alreadyLinked ? 'Já Vinculado' : 'Vinculado com Sucesso!'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
            {result.student && (
              <p className="text-xs text-muted-foreground mt-2">
                {result.student.className}
              </p>
            )}
          </div>

          {result.hasMoreStudents && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Tem mais filhos nesta turma?
              </p>
              <Button variant="outline" onClick={handleLinkAnother} className="w-full">
                <Users className="h-4 w-4 mr-2" />
                Vincular outro aluno
              </Button>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Agora você pode acessar o app Safe Door para acompanhar a frequência escolar.
            </p>
            <Button
              variant="default"
              className="w-full mt-3"
              onClick={() => window.location.href = '/auth/login'}
            >
              Acessar o App
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
