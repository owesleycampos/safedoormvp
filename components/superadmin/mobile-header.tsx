'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Menu, LayoutDashboard, School, CreditCard, Cloud,
  ScrollText, Settings, LogOut, Shield, Webhook,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const nav = [
  { href: '/odono',            icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/odono/schools',     icon: School,          label: 'Escolas' },
  { href: '/odono/billing',     icon: CreditCard,      label: 'Faturamento' },
  { href: '/odono/aws',         icon: Cloud,           label: 'AWS Contas' },
  { href: '/odono/webhooks',    icon: Webhook,         label: 'Webhooks' },
  { href: '/odono/logs',        icon: ScrollText,      label: 'Logs' },
  { href: '/odono/settings',    icon: Settings,        label: 'Configurações' },
];

export function SuperAdminMobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  function isActive(href: string) {
    if (href === '/odono') return pathname === '/odono';
    return pathname === href || pathname.startsWith(href + '/');
  }

  const currentPage = nav.find((n) => isActive(n.href))?.label ?? 'SuperAdmin';

  return (
    <>
      <div className="lg:hidden flex items-center justify-between h-12 px-4 border-b border-border bg-background sticky top-0 z-30">
        <button
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{currentPage}</span>
          <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded">
            <Shield className="h-2.5 w-2.5" />
            Super
          </span>
        </div>
        <ThemeToggle className="h-8 w-8" />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[260px] p-0 flex flex-col">
          <div className="flex items-center h-12 px-4 border-b border-border flex-shrink-0">
            <Logo size="xs" showText />
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <div className={cn('nav-item', active && 'active')}>
                    <item.icon
                      className={cn(
                        'h-4 w-4 flex-shrink-0',
                        active ? 'text-emerald-400' : 'text-muted-foreground'
                      )}
                      strokeWidth={active ? 2 : 1.5}
                    />
                    <span className={active ? 'text-foreground' : ''}>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border px-2 py-3 flex-shrink-0">
            <div className="flex items-center gap-2.5 px-2 py-2">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-[10px] bg-emerald-500/20 text-emerald-400">
                  {getInitials(user?.name || user?.email || 'SA')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.name || 'SuperAdmin'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
