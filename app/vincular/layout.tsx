import { Logo } from '@/components/shared/logo';

export const metadata = {
  title: 'Vincular Aluno | Safe Door',
  description: 'Vincule seu filho(a) à sua conta Safe Door.',
};

export default function VincularLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          <Logo size="xs" showText />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        {children}
      </main>
    </div>
  );
}
