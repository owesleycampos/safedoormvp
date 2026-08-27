/**
 * Executa `fn` sobre `items` com no máximo `limit` tarefas em voo ao mesmo
 * tempo, preservando a ORDEM dos resultados (results[i] corresponde a items[i]).
 *
 * Para os crons: com 100 escolas, iterar uma de cada vez soma a latência de
 * todas e arrisca estourar o timeout da função serverless. Rodar tudo de uma vez
 * (Promise.all sem limite) abre conexões demais no banco e pode saturar a AWS.
 * Um teto de concorrência resolve os dois lados.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
