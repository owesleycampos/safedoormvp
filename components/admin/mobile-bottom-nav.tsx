'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ADMIN_NAV_PRIMARY, isNavActive } from '@/lib/admin-nav';

/**
 * Phone bottom bar with the day-to-day destinations. Everything else stays in
 * the drawer behind the top-bar menu button. This component existed but was
 * never mounted anywhere — on phones all navigation went through the drawer.
 */
export function AdminMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      // data-bottom-bar: o globals.css levanta esta barra quando a faixa de
      // impersonação está na tela (senão a faixa a cobre por inteiro).
      data-bottom-bar
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-border bg-background/90 backdrop-blur-xl"
      style={{ paddingTop: '0.375rem', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {ADMIN_NAV_PRIMARY.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[3.5rem] transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
            <span className={cn('text-[10px] leading-none', active && 'font-semibold')}>
              {item.short ?? item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
