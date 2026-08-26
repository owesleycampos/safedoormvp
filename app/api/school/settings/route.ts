import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_SHIFTS = ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;

  let settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });

  // Auto-create defaults if not yet configured
  if (!settings) {
    settings = await prisma.schoolSettings.create({
      data: { schoolId },
    });
  }

  return NextResponse.json(settings);
}

/**
 * Validates and re-serializes the per-shift schedule JSON.
 * Shape: { MANHA: { entry, entryLimit, exit }, ... }
 * Returns the clean JSON string, null to clear, or an Error message.
 */
function validateShiftSchedules(input: unknown): string | null | { error: string } {
  if (input === null || input === '') return null;
  let obj: any = input;
  if (typeof input === 'string') {
    try { obj = JSON.parse(input); } catch { return { error: 'shiftSchedules: JSON inválido.' }; }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return { error: 'shiftSchedules deve ser um objeto { TURNO: { entry, entryLimit, exit } }.' };
  }
  const clean: Record<string, { entry: string; entryLimit: string; exit: string }> = {};
  for (const [shift, value] of Object.entries(obj)) {
    if (!VALID_SHIFTS.includes(shift)) {
      return { error: `Turno inválido: ${shift}. Use ${VALID_SHIFTS.join(', ')}.` };
    }
    const v = value as any;
    for (const field of ['entry', 'entryLimit', 'exit'] as const) {
      if (typeof v?.[field] !== 'string' || !TIME_RE.test(v[field])) {
        return { error: `Horário inválido em ${shift}.${field} (use HH:MM).` };
      }
    }
    clean[shift] = { entry: v.entry, entryLimit: v.entryLimit, exit: v.exit };
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;

  try {
    const body = await req.json();
    const {
      entryStartTime, entryEndTime, exitStartTime, exitEndTime,
      minConfidence, notifyOnEntry, notifyOnExit, timezone,
      // (timezone validado logo abaixo — um valor inválido derrubava TODAS
      // as contas de data da escola com RangeError, sem volta pela UI)
    } = body;

    for (const [name, value] of Object.entries({ entryStartTime, entryEndTime, exitStartTime, exitEndTime })) {
      if (value !== undefined && (typeof value !== 'string' || !TIME_RE.test(value))) {
        return NextResponse.json({ error: `${name} inválido (use HH:MM).` }, { status: 400 });
      }
    }

    if (minConfidence !== undefined && (typeof minConfidence !== 'number' || minConfidence < 0.5 || minConfidence > 0.99)) {
      return NextResponse.json({ error: 'minConfidence deve estar entre 0.5 e 0.99.' }, { status: 400 });
    }

    let tzClean: string | undefined = undefined;
    if (timezone !== undefined) {
      try {
        new Intl.DateTimeFormat('pt-BR', { timeZone: String(timezone) });
        tzClean = String(timezone);
      } catch {
        return NextResponse.json({ error: 'Fuso horário inválido.' }, { status: 400 });
      }
    }

    let shiftSchedules: string | null | undefined = undefined;
    if ('shiftSchedules' in body) {
      const validated = validateShiftSchedules(body.shiftSchedules);
      if (validated && typeof validated === 'object' && 'error' in validated) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      shiftSchedules = validated;
    }

    const data = {
      ...(entryStartTime !== undefined && { entryStartTime }),
      ...(entryEndTime !== undefined && { entryEndTime }),
      ...(exitStartTime !== undefined && { exitStartTime }),
      ...(exitEndTime !== undefined && { exitEndTime }),
      ...(minConfidence !== undefined && { minConfidence }),
      ...(notifyOnEntry !== undefined && { notifyOnEntry: !!notifyOnEntry }),
      ...(notifyOnExit !== undefined && { notifyOnExit: !!notifyOnExit }),
      ...(tzClean !== undefined && { timezone: tzClean }),
      ...(shiftSchedules !== undefined && { shiftSchedules }),
    };

    const settings = await prisma.schoolSettings.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });

    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
