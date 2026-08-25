'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Menu, LogOut } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { ADMIN_NAV, ADMIN_NAV_SECONDARY, ADMIN_NAV_ALL, isNavActive } from '@/lib/admin-nav';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export function AdminMobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  const isActive = (href: string) => isNavActive(pathname, href);
  const currentPage = ADMIN_NAV_ALL.find((n) => isActive(n.href))?.label ?? 'Safe Door';

  function NavLinks({ items }: { items: typeof ADMIN_NAV }) {
    return (
      <>
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <div className={cn('nav-item group', active && 'active')}>
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg transition-all flex-shrink-0',
                  active ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                )}>
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
                </div>
                <span className={cn(
                  'text-[13px]',
                  active ? 'text-foreground font-semibold' : 'text-muted-foreground'
                )}>
                  {item.label}
                </span>
                {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </div>
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <>
      {/* Mobile Top Bar — glass style */}
      <div className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="h-[18px] w-[18px] text-muted-foreground" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">{currentPage}</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle className="h-9 w-9" />
        </div>
      </div>

      {/* Mobile Drawer — same list, same order and same hierarchy as the
          desktop sidebar. The fake search field (a div with no handler that
          did nothing when tapped) was removed. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-sidebar">
          {/* Logo */}
          <div className="flex items-center h-16 px-5 flex-shrink-0">
            <Logo size="xs" showText />
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
            <NavLinks items={ADMIN_NAV} />
            <div className="my-3 h-px bg-border" />
            <NavLinks items={ADMIN_NAV_SECONDARY} />
          </nav>

          {/* User */}
          <div className="border-t border-sidebar-border px-3 py-3 flex-shrink-0">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
                  {getInitials(user?.name || user?.email || 'A')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{user?.name || 'Admin'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
