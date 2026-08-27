/**
 * Fonte ÚNICA da receita mensal de uma assinatura.
 *
 * O desconto (`discount`) é o abatimento da cobrança ANUAL — por isso só entra
 * na conta quando `billing === 'ANNUAL'`. Antes cada tela calculava isso à mão:
 * o Monitor aplicava o desconto em TODA assinatura ativa e divergia do Dashboard
 * e do Billing (que só aplicam no anual). Resultado: dois MRR diferentes no mesmo
 * console. Agora todos chamam esta função.
 *
 * Retorna centavos. Só ACTIVE é receita — TRIAL/CANCELLED não somam.
 */
export interface RevenueSub {
  status: string;
  billing: string;
  priceMonthly: number;
  discount: number;
}

export function monthlyRevenueCents(sub: RevenueSub): number {
  if (sub.status !== 'ACTIVE') return 0;
  const net = sub.billing === 'ANNUAL'
    ? sub.priceMonthly * (1 - (sub.discount || 0))
    : sub.priceMonthly;
  return Math.round(net);
}

/** MRR de uma lista de assinaturas, em centavos. */
export function mrrCents(subs: RevenueSub[]): number {
  return subs.reduce((acc, s) => acc + monthlyRevenueCents(s), 0);
}
