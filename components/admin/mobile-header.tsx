'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Menu, LayoutDashboard, GraduationCap, Users, UserCheck,
  Video, ScanFace, Settings, LogOut, X, ClipboardList, BookOpen,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const nav = [
  { href: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard'         },
  { href: '/admin/students',     icon: GraduationCap,   label: 'Alunos'            },
  { href: '/admin/classes',      icon: Users,           label: 'Turmas'            },
  { href: '/admin/parents',      icon: UserCheck,       label: 'Responsáveis'      },
  { href: '/admin/camera',       icon: Video,           label: 'Câmera ao Vivo'   },
  { href: '/admin/attendance',   icon: ClipboardList,   label: 'Frequência'        },
  { href: '/admin/subjects',     icon: BookOpen,        label: 'Matérias'          },
  { href: '/admin/unrecognized', icon: ScanFace,        label: 'Não Identificados' },
  { href: '/admin/settings',     icon: Settings,        label: 'Configurações'     },
];

export function AdminMobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  const currentPage = nav.find((n) => isActive(n.href))?.label ?? 'Admin';

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between h-12 px-4 border-b border-border bg-background sticky top-0 z-30">
        <button
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold">{currentPage}</span>
        <ThemeToggle className="h-8 w-8" />
      </div>

      {/* Mobile Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[260px] p-0 flex flex-col">
          {/* Logo */}
          <div className="flex items-center h-12 px-4 border-b border-border flex-shrink-0">
            <Logo size="xs" showText />
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <div className={cn('nav-item', active && 'active')}>
                    <item.icon
                      className={cn(
                        'h-4 w-4 flex-shrink-0',
                        active ? 'text-foreground' : 'text-muted-foreground'
                      )}
                      strokeWidth={active ? 2 : 1.5}
                    />
                    <span className={active ? 'text-foreground' : ''}>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="border-t border-border px-2 py-3 flex-shrink-0">
            <div className="flex items-center gap-2.5 px-2 py-2">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-[10px] bg-accent text-muted-foreground">
                  {getInitials(user?.name || user?.email || 'A')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.name || 'Admin'}</p>
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
