/**
 * Gera todos os PNGs da marca a partir do vetor único.
 * Uso: node scripts/generate-icons.mjs
 *
 * A pasta public/icons/ estava VAZIA: o manifest referenciava 8 ícones que
 * não existiam e o push apontava para /icons/icon-192x192.png inexistente.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const MARK = `
<polygon points="112,190 260,102 408,194 370,215 260,150 150,213"/>
<rect x="112" y="190" width="9" height="62"/>
<circle cx="116.5" cy="262" r="11"/>
<polygon points="106,278 127,278 123,322 110,322"/>
<path fill-rule="evenodd" d="M174 208 H346 V414 H174 Z M193 227 H327 V414 H193 Z"/>
<polygon points="166,414 354,414 374,430 146,430"/>
<rect x="118" y="432" width="278" height="8"/>
<path fill-rule="evenodd" d="M246 250 L350 214 V440 L246 406 Z M262 314 a10 13 0 1 0 20 0 a10 13 0 1 0 -20 0 Z"/>`;

// símbolo branco centrado, com respiro proporcional (m = margem em % do lado)
function svg(variant) {
  if (variant === 'square') {
    // quadrado preto — ícone de app / favicon (como a referência)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#000"/>
      <g fill="#fff" transform="translate(31,31) scale(0.879)">${MARK}</g>
    </svg>`;
  }
  if (variant === 'circle') {
    // disco preto em fundo transparente — versão "Instagram" do tema claro
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <circle cx="256" cy="256" r="256" fill="#000"/>
      <g fill="#fff" transform="translate(77,77) scale(0.699)">${MARK}</g>
    </svg>`;
  }
  // símbolo branco em fundo transparente — badge de notificação e tema escuro
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g fill="#fff">${MARK}</g>
  </svg>`;
}

const jobs = [
  // manifest (8 tamanhos referenciados)
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((s) => ({
    out: `public/icons/icon-${s}x${s}.png`, size: s, variant: 'square',
  })),
  { out: 'public/icons/apple-touch-icon.png', size: 180, variant: 'square' },
  // badge monocromático usado pelo push (lib/notifications + sw-custom)
  { out: 'public/icons/badge-72x72.png', size: 72, variant: 'white' },
  // artes gerais
  { out: 'public/logo.png', size: 512, variant: 'square' },
  { out: 'public/logo-light.png', size: 512, variant: 'circle' },
  // favicon do app dir (Next serve app/icon.png automaticamente)
  { out: 'app/icon.png', size: 512, variant: 'square' },
];

mkdirSync('public/icons', { recursive: true });
for (const { out, size, variant } of jobs) {
  await sharp(Buffer.from(svg(variant))).resize(size, size).png().toFile(out);
  console.log(`  ${out} (${size}px, ${variant})`);
}
console.log('done');
