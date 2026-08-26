import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { OnboardingTour } from './onboarding-tour';

export const metadata = { title: 'Bem-vindo' };

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') redirect('/auth/login');

  const schoolId = (session.user as any)?.schoolId;
  const school = schoolId
    ? await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, ownerName: true } })
    : null;

  return <OnboardingTour schoolName={school?.name || 'sua escola'} ownerName={school?.ownerName || ''} />;
}
