import { prisma } from '@/lib/db';

interface ShiftSchedule {
  entry: string;       // e.g. "07:00"
  entryLimit: string;  // e.g. "07:30" — after this = late
  exit: string;        // e.g. "12:00" — before this = early exit
}

const DEFAULT_SHIFT_SCHEDULES: Record<string, ShiftSchedule> = {
  MANHA:    { entry: '07:00', entryLimit: '07:30', exit: '12:00' },
  TARDE:    { entry: '13:00', entryLimit: '13:30', exit: '17:30' },
  NOITE:    { entry: '18:30', entryLimit: '19:00', exit: '22:00' },
  INTEGRAL: { entry: '07:00', entryLimit: '07:30', exit: '17:30' },
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Get the shift schedule for a student's class.
 * Falls back to school-wide settings if no shift-specific config exists.
 */
async function getScheduleForStudent(studentId: string): Promise<ShiftSchedule | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      class: { select: { shift: true } },
      school: {
        select: {
          settings: {
            select: {
              entryStartTime: true,
              entryEndTime: true,
              exitStartTime: true,
              exitEndTime: true,
              shiftSchedules: true,
            },
          },
        },
      },
    },
  });

  if (!student) return null;

  const shift = student.class?.shift;
  const settings = student.school?.settings;

  // Try shift-specific schedule from school settings JSON
  if (shift && settings?.shiftSchedules) {
    try {
      const parsed = JSON.parse(settings.shiftSchedules) as Record<string, ShiftSchedule>;
      if (parsed[shift]) return parsed[shift];
    } catch {
      // Invalid JSON, fall through
    }
  }

  // Try default shift schedule
  if (shift && DEFAULT_SHIFT_SCHEDULES[shift]) {
    return DEFAULT_SHIFT_SCHEDULES[shift];
  }

  // Fall back to school-wide settings
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
 * Determine attendance status based on school schedule.
 * Returns a notes string if the event is late or early, null otherwise.
 */
export async function determineAttendanceStatus(
  studentId: string,
  eventType: 'ENTRY' | 'EXIT',
  timestamp: Date
): Promise<AttendanceStatus> {
  const schedule = await getScheduleForStudent(studentId);
  if (!schedule) return null;

  const eventMinutes = timestamp.getHours() * 60 + timestamp.getMinutes();

  if (eventType === 'ENTRY') {
    const limitMinutes = timeToMinutes(schedule.entryLimit);
    if (eventMinutes > limitMinutes) {
      return 'ATRASO';
    }
    return 'ON_TIME';
  }

  if (eventType === 'EXIT') {
    const exitMinutes = timeToMinutes(schedule.exit);
    if (eventMinutes < exitMinutes) {
      return 'SAIDA_ANTECIPADA';
    }
    return 'ON_TIME';
  }

  return null;
}
