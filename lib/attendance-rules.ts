import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, localMinutes } from '@/lib/timezone';

export interface ShiftSchedule {
  entry: string;       // e.g. "07:00"
  entryLimit: string;  // e.g. "07:30" — after this = late
  exit: string;        // e.g. "12:00" — before this = early exit
}

export const DEFAULT_SHIFT_SCHEDULES: Record<string, ShiftSchedule> = {
  MANHA:    { entry: '07:00', entryLimit: '07:30', exit: '12:00' },
  TARDE:    { entry: '13:00', entryLimit: '13:30', exit: '17:30' },
  NOITE:    { entry: '18:30', entryLimit: '19:00', exit: '22:00' },
  INTEGRAL: { entry: '07:00', entryLimit: '07:30', exit: '17:30' },
};

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export interface SettingsForSchedule {
  entryStartTime: string;
  entryEndTime: string;
  exitStartTime: string;
  exitEndTime: string;
  shiftSchedules: string | null;
  timezone?: string | null;
}

/**
 * Resolve the effective schedule for a class shift. Pure function.
 *
 * Precedence (most specific wins):
 *  1. Per-shift schedule the school configured (settings.shiftSchedules JSON,
 *     editable in the settings UI)
 *  2. Built-in per-shift defaults (only when the school never configured
 *     that shift)
 *  3. School-wide entry/exit windows (classes without a shift)
 */
export function resolveSchedule(
  shift: string | null | undefined,
  settings: SettingsForSchedule | null | undefined
): ShiftSchedule | null {
  if (shift && settings?.shiftSchedules) {
    try {
      const parsed = JSON.parse(settings.shiftSchedules) as Record<string, ShiftSchedule>;
      const s = parsed[shift];
      if (s?.entry && s?.entryLimit && s?.exit) return s;
    } catch {
      // Invalid JSON, fall through
    }
  }

  if (shift && DEFAULT_SHIFT_SCHEDULES[shift]) {
    return DEFAULT_SHIFT_SCHEDULES[shift];
  }

  if (settings) {
    return {
      entry: settings.entryStartTime,
      entryLimit: settings.entryEndTime,
      exit: settings.exitStartTime,
    };
  }

  return null;
}

export type AttendanceStatus = 'ON_TIME' | 'ATRASO' | 'SAIDA_ANTECIPADA' | null;

/**
 * Classify an event given the schedule and the LOCAL time of day. Pure function.
 * `eventMinutes` must be minutes since midnight in the SCHOOL's timezone.
 */
export function computeStatus(
  schedule: ShiftSchedule | null,
  eventType: 'ENTRY' | 'EXIT',
  eventMinutes: number
): AttendanceStatus {
  if (!schedule) return null;

  if (eventType === 'ENTRY') {
    return eventMinutes > timeToMinutes(schedule.entryLimit) ? 'ATRASO' : 'ON_TIME';
  }

  if (eventType === 'EXIT') {
    return eventMinutes < timeToMinutes(schedule.exit) ? 'SAIDA_ANTECIPADA' : 'ON_TIME';
  }

  return null;
}

/**
 * Determine attendance status for a student's event, converting the UTC
 * timestamp to the school's timezone before comparing against the schedule.
 */
