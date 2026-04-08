import { prisma } from '@/lib/db';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  let settings = await prisma.platformSettings.findFirst();

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: {},
    });
  }

  return (
    <SettingsClient
      settings={{
        id: settings.id,
        defaultPlan: settings.defaultPlan,
        trialDays: settings.trialDays,
        essencialPrice: settings.essencialPrice,
        profissionalPrice: settings.profissionalPrice,
        premiumPrice: settings.premiumPrice,
        annualDiscount: settings.annualDiscount,
        maxStudentsEssencial: settings.maxStudentsEssencial,
        maxStudentsProfissional: settings.maxStudentsProfissional,
        maxStudentsPremium: settings.maxStudentsPremium,
      }}
    />
  );
}
