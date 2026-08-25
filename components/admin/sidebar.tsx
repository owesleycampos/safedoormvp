'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { ADMIN_NAV, ADMIN_NAV_SECONDARY, isNavActive } from '@/lib/admin-nav';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  const isActive = (href: string) => isNavActive(pathname, href);

  return (
    <aside className="sidebar fixed inset-y-0 left-0 z-40 hidden lg:flex w-[220px] flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center px-5">
        <Logo size="xs" showText />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {ADMIN_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn('nav-item', active && 'active')}>
                <item.icon
                  className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground', active && 'text-foreground')}
                  strokeWidth={1.5}
                />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}

        <div className="my-3 h-px bg-border" />

        {ADMIN_NAV_SECONDARY.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn('nav-item', active && 'active')}>
                <item.icon
                  className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground', active && 'text-foreground')}
                  strokeWidth={1.5}
                />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground">
              {getInitials(user?.name || user?.email || 'A')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate leading-tight">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <ThemeToggle className="h-7 w-7" />
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
