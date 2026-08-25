/**
 * Marca do Porta Segura: porta entreaberta com capelo de formatura como telhado
 * e borla pendendo à esquerda. Vetor recriado a partir da referência enviada
 * (bitmap preto e branco), para escalar sem serrilhado em qualquer tamanho.
 *
 * O símbolo é desenhado em `currentColor`; o vão da porta e a maçaneta são
 * recortes reais (fill-rule evenodd), então o fundo aparece através deles —
 * funciona sobre o disco preto do tema claro e sobre o fundo do tema escuro
 * sem precisar de duas artes.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Capelo (telhado) */}
      <polygon points="112,190 260,102 408,194 370,215 260,150 150,213" />
      {/* Borla: cordão, botão e pingente */}
      <rect x="112" y="190" width="9" height="62" />
      <circle cx="116.5" cy="262" r="11" />
      <polygon points="106,278 127,278 123,322 110,322" />
      {/* Batente da porta (anel com vão recortado) */}
      <path
        fillRule="evenodd"
        d="M174 208 H346 V414 H174 Z M193 227 H327 V414 H193 Z"
      />
      {/* Soleira e linha de chão */}
      <polygon points="166,414 354,414 374,430 146,430" />
      <rect x="118" y="432" width="278" height="8" />
      {/* Folha da porta aberta, com a maçaneta recortada */}
      <path
        fillRule="evenodd"
        d="M246 250 L350 214 V440 L246 406 Z M262 314 a10 13 0 1 0 20 0 a10 13 0 1 0 -20 0 Z"
      />
    </svg>
  );
}
