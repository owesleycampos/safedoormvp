import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE } from '@/lib/timezone';

/** The school's configured IANA timezone, falling back to America/Sao_Paulo. */
export async function getSchoolTimezone(schoolId: string): Promise<string> {
  const settings = await prisma.schoolSettings.findUnique({
    where: { schoolId },
    select: { timezone: true },
  });
  return settings?.timezone || DEFAULT_TIMEZONE;
}
