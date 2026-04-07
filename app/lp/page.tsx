import type { Metadata } from 'next';
import { LandingPageClient } from './landing-client';

export const metadata: Metadata = {
  title: 'Safe Door — Reconhecimento Facial para Escolas',
  description:
    'Controle de acesso e frequência escolar por reconhecimento facial. Notificações em tempo real para pais. Sem catracas, sem hardware.',
  openGraph: {
    title: 'Safe Door — Reconhecimento Facial para Escolas',
    description: 'Controle de acesso e frequência escolar por reconhecimento facial.',
    type: 'website',
    locale: 'pt_BR',
  },
};

export default function LandingPage() {
  return <LandingPageClient />;
}
