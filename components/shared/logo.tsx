'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  collapsed?: boolean;
}

const sizes = {
  xs: { img: 20, text: 'text-sm',   gap: 'gap-2'   },
  sm: { img: 26, text: 'text-base', gap: 'gap-2.5' },
  md: { img: 32, text: 'text-lg',   gap: 'gap-3'   },
  lg: { img: 48, text: 'text-2xl',  gap: 'gap-4'   },
};

export function Logo({ size = 'sm', className, showText = true, collapsed = false }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const s = sizes[size];
  // Use light logo on light backgrounds, dark logo on dark backgrounds
  const src = mounted && resolvedTheme !== 'dark' ? '/logo-light.png' : '/logo.png';

  return (
    <div className={cn('flex items-center', s.gap, className)}>
      <Image
        src={src}
        alt="Safe Door"
        width={s.img}
        height={s.img}
        className="flex-shrink-0 object-contain"
        priority
      />
      {showText && !collapsed && (
        <span className={cn('font-semibold tracking-tight text-foreground leading-none', s.text)}>
          Safe Door
        </span>
      )}
    </div>
  );
}
