'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Video, GraduationCap, ClipboardList, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin/dashboard',  icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/admin/camera',     icon: Video,           label: 'Câmera'     },
  { href: '/admin/students',   icon: GraduationCap,   label: 'Alunos'     },
  { href: '/admin/attendance', icon: ClipboardList,   label: 'Frequência' },
];

export function AdminMobileBottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-border/50 bg-background/80 backdrop-blur-xl"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[3.5rem] active:opacity-60 transition-all"
          >
            <div className={cn(
              'flex items-center justify-center transition-all duration-200',
              active && 'scale-110'
            )}>
              <tab.icon
                className={cn(
                  'h-[22px] w-[22px] transition-all duration-200',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
                strokeWidth={active ? 2 : 1.5}
              />
            </div>
            <span className={cn(
              'text-[10px] font-medium tracking-tight leading-none transition-colors duration-200',
              active ? 'text-primary' : 'text-muted-foreground'
            )}>
              {tab.label}
            </span>
          </Link>
        );
      })}

      {/* More */}
      <Link
        href="/admin/settings"
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[3.5rem] active:opacity-60 transition-all"
      >
        <MoreHorizontal className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.5} />
        <span className="text-[10px] font-medium tracking-tight leading-none text-muted-foreground">
          Mais
        </span>
      </Link>
    </nav>
  );
}
