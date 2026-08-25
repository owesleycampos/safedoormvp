import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/shared/logo-mark';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  collapsed?: boolean;
}

const sizes = {
  xs: { img: 22, text: 'text-sm',   gap: 'gap-2'   },
  sm: { img: 28, text: 'text-base', gap: 'gap-2.5' },
  md: { img: 34, text: 'text-lg',   gap: 'gap-3'   },
  lg: { img: 52, text: 'text-2xl',  gap: 'gap-4'   },
};

/**
 * No tema claro a marca vive num disco preto (estilo avatar do Instagram);
 * no escuro o símbolo branco fica direto sobre o fundo. Trocado por CSS
 * (`dark:`), então não há mais o flash de imagem errada que o antigo
 * useTheme + <Image> causava no primeiro paint.
 */
export function Logo({ size = 'sm', className, showText = true, collapsed = false }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={cn('flex items-center', s.gap, className)}>
      <span
        className="flex-shrink-0 flex items-center justify-center rounded-full bg-black text-white dark:bg-transparent"
        style={{ width: s.img, height: s.img }}
      >
        <LogoMark className="h-[70%] w-[70%] dark:h-full dark:w-full" />
      </span>
      {showText && !collapsed && (
        <span className={cn('font-semibold tracking-tight text-foreground leading-none', s.text)}>
          Safe Door
        </span>
      )}
    </div>
  );
}
