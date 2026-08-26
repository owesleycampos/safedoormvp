/**
 * Reexecuta a cada navegação dentro da área (diferente do layout, que
 * persiste): é o que permite a animação de entrada em toda troca de página.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
