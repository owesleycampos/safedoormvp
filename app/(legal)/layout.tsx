import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

/**
 * Páginas legais (Termos e Privacidade). Elas eram exigidas no aceite LGPD
 * do cadastro e simplesmente não existiam — o responsável consentia com dois
 * documentos que davam 404.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center">
          <Link href="/"><Logo size="xs" showText /></Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <article className="space-y-6 text-sm leading-relaxed text-foreground/90 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-8 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </article>
      </main>
    </div>
  );
}
