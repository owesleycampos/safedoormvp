'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, GraduationCap, Video, ClipboardList, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { AdminMobileHeader } from './mobile-header';

const tabs = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/students',  icon: GraduationCap,   label: 'Alunos'    },
  { href: '/admin/camera',    icon: Video,           label: 'Câmera'    },
  { href: '/admin/attendance', icon: ClipboardList,   label: 'Frequência'},
];

export function AdminMobileBottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  const activeTab = tabs.find((t) => isActive(t.href));

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border flex"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[3.25rem] active:opacity-60 transition-opacity"
          >
            <tab.icon
              className={cn(
                'h-[22px] w-[22px] transition-all',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
              strokeWidth={active ? 2 : 1.5}
            />
            <span className={cn(
              'text-[10px] font-medium tracking-tight leading-none',
              active ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {tab.label}
            </span>
          </Link>
        );
      })}

      {/* "Mais" — opens the drawer menu */}
      <MoreButton />
    </nav>
  );
}

function MoreButton() {
  // We use a hidden trigger on the mobile header's internal state.
  // Simplest approach: re-render AdminMobileHeader trigger hidden, but
  // just navigate to settings as the "more" destination for now.
  return (
    <Link
      href="/admin/settings"
      className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[3.25rem] active:opacity-60 transition-opacity"
    >
      <MoreHorizontal
        className="h-[22px] w-[22px] text-muted-foreground"
        strokeWidth={1.5}
      />
      <span className="text-[10px] font-medium tracking-tight leading-none text-muted-foreground">
        Mais
      </span>
    </Link>
  );
}
