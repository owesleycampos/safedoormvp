/**
 * Decisão pura: uma sessão de impersonação já expirou?
 *
 * A sessão JWT do NextAuth é rolante — o cookie é reescrito com o maxAge global
 * (7 dias) a cada request. Por isso o teto de 1h da impersonação NÃO pode
 * depender do maxAge do cookie; depende de um prazo ABSOLUTO (`impExp`, em ms)
 * gravado no token na hora de impersonar e verificado no callback de sessão.
 * Só se aplica a tokens de impersonação (têm `impersonatedBy`).
 */
export interface ImpersonationClaims {
  impersonatedBy?: unknown;
  impExp?: unknown;
}

export function isImpersonationExpired(token: ImpersonationClaims | null | undefined, nowMs: number): boolean {
  if (!token) return false;
  if (!token.impersonatedBy) return false; // sessão normal, nunca expira por aqui
  const exp = Number(token.impExp);
  if (!Number.isFinite(exp) || exp <= 0) return false; // sem prazo → não força expiração
  return nowMs > exp;
}
