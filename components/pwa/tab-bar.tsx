'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Baby, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/pwa/children', icon: Baby,  label: 'Filhos'    },
  { href: '/pwa/timeline', icon: Clock, label: 'Timeline'  },
  { href: '/pwa/profile',  icon: User,  label: 'Perfil'    },
];

export function PwaTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="tab-bar"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[3rem] active:opacity-70 transition-opacity"
          >
            <tab.icon
              className={cn(
                'h-[22px] w-[22px] transition-all',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span className={cn(
              'text-[10px] font-medium tracking-tight leading-none',
              isActive ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
