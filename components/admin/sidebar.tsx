'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, Video, ScanFace, GraduationCap,
  Users, UserCheck, ClipboardList, CalendarDays,
  Settings, LogOut,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const nav = [
  { href: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard'         },
  { href: '/admin/camera',       icon: Video,           label: 'Câmera ao Vivo'    },
  { href: '/admin/unrecognized', icon: ScanFace,        label: 'Não Identificados' },
  { href: '/admin/students',     icon: GraduationCap,   label: 'Alunos'            },
  { href: '/admin/classes',      icon: Users,           label: 'Turmas'            },
  { href: '/admin/parents',      icon: UserCheck,       label: 'Responsáveis'      },
  { href: '/admin/attendance',   icon: ClipboardList,   label: 'Frequência'        },
  { href: '/admin/subjects',     icon: CalendarDays,    label: 'Grade Escolar'     },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className="sidebar fixed inset-y-0 left-0 z-40 hidden lg:flex w-[220px] flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center px-5">
        <Logo size="xs" showText />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {nav.map((item) => {
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

        <Link href="/admin/settings">
          <div className={cn('nav-item', isActive('/admin/settings') && 'active')}>
            <Settings
              className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground', isActive('/admin/settings') && 'text-foreground')}
              strokeWidth={1.5}
            />
            <span>Configurações</span>
          </div>
        </Link>
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
