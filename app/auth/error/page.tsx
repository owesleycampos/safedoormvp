import Link from 'next/link';

/**
 * Página de erro do NextAuth — estava configurada em lib/auth.ts e não
 * existia: qualquer erro de autenticação caía num 404 seco.
 */
export const metadata = { title: 'Erro de acesso' };

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">Não foi possível entrar</h1>
        <p className="text-sm text-muted-foreground">
          Algo deu errado na autenticação. Tente de novo — se continuar,
          fale com a escola.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
