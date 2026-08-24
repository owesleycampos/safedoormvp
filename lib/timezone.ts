/**
 * Timezone-aware date helpers.
 *
 * Every "day" and "time of day" in this system is defined in the SCHOOL's
 * timezone, never the server's. The server (e.g. Vercel) runs in UTC, so
 * naive `setHours(0,0,0,0)` / `getHours()` math shifts everything by 3h+
 * for Brazilian schools. All day-boundary and schedule logic must go
 * through these helpers.
 */

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    dtfCache.set(timeZone, dtf);
  }
  return dtf;
}

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock components of a UTC instant, as seen in the given timezone. */
export function wallClockInTz(date: Date, timeZone: string): WallClock {
  const parts = getFormatter(timeZone).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: map.hour === '24' ? 0 : Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Minutes since local midnight for a UTC instant, in the given timezone. */
export function localMinutes(date: Date, timeZone: string): number {
  const wc = wallClockInTz(date, timeZone);
  return wc.hour * 60 + wc.minute;
}

/** Local calendar date "YYYY-MM-DD" for a UTC instant, in the given timezone. */
export function localDateStr(date: Date, timeZone: string): string {
  const wc = wallClockInTz(date, timeZone);
  const mm = String(wc.month).padStart(2, '0');
  const dd = String(wc.day).padStart(2, '0');
  return `${wc.year}-${mm}-${dd}`;
}

/** Offset (ms) of the timezone relative to UTC at the given instant. */
function tzOffsetMs(timeZone: string, date: Date): number {
  const wc = wallClockInTz(date, timeZone);
  const asUTC = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  return asUTC - date.getTime();
}

/**
 * UTC instant of local midnight for the calendar date "YYYY-MM-DD"
 * in the given timezone. DST-safe (double-checks the offset).
 */
export function zonedMidnightUtc(dateStr: string, timeZone: string): Date {
  const guess = new Date(`${dateStr}T00:00:00Z`);
  const offset = tzOffsetMs(timeZone, guess);
  let result = new Date(guess.getTime() - offset);
  const offset2 = tzOffsetMs(timeZone, result);
  if (offset2 !== offset) result = new Date(guess.getTime() - offset2);
  return result;
}

/** Add n calendar days to a "YYYY-MM-DD" string (timezone-independent). */
export function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`); // noon avoids any DST edge
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface DayRange {
  /** UTC instant of local 00:00 on the day containing `date` */
  start: Date;
  /** UTC instant of local 00:00 on the next day (exclusive) */
  end: Date;
  /** Local calendar date "YYYY-MM-DD" */
  dateStr: string;
}

/** The local calendar day (as UTC instants) containing the given instant. */
export function dayRangeInTz(date: Date, timeZone: string): DayRange {
  const dateStr = localDateStr(date, timeZone);
  return dayRangeForDateStr(dateStr, timeZone);
}

/** The local calendar day (as UTC instants) for a "YYYY-MM-DD" string. */
export function dayRangeForDateStr(dateStr: string, timeZone: string): DayRange {
  return {
    start: zonedMidnightUtc(dateStr, timeZone),
    end: zonedMidnightUtc(addDaysStr(dateStr, 1), timeZone),
    dateStr,
  };
}

/** Day of week (0=Sun … 6=Sat) of a "YYYY-MM-DD" calendar date. */
export function weekdayOfDateStr(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** True if the "YYYY-MM-DD" calendar date is Saturday or Sunday. */
export function isWeekendDateStr(dateStr: string): boolean {
  const dow = weekdayOfDateStr(dateStr);
  return dow === 0 || dow === 6;
}
