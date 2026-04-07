'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, GraduationCap, Users, UserCheck,
  ScanFace, Settings, LogOut,
  ChevronRight, Video, ClipboardList, BookOpen,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const nav = [
  { href: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard'        },
  { href: '/admin/students',     icon: GraduationCap,   label: 'Alunos'           },
  { href: '/admin/classes',      icon: Users,           label: 'Turmas'           },
  { href: '/admin/parents',      icon: UserCheck,       label: 'Responsáveis'     },
  { href: '/admin/camera',       icon: Video,           label: 'Câmera ao Vivo'   },
  { href: '/admin/attendance',   icon: ClipboardList,   label: 'Frequência'       },
  { href: '/admin/subjects',     icon: BookOpen,        label: 'Matérias'         },
  { href: '/admin/unrecognized', icon: ScanFace,        label: 'Não Identificados'},
];

const bottom = [
  { href: '/admin/settings', icon: Settings, label: 'Configurações' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="sidebar fixed inset-y-0 left-0 z-40 hidden lg:flex w-[220px] flex-col">

        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
          <Logo size="xs" showText />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {nav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
            />
          ))}

          <div className="my-3 h-px bg-border" />

          {bottom.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
            />
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border px-2 py-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarFallback className="text-[10px] bg-accent text-muted-foreground">
                {getInitials(user?.name || user?.email || 'A')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate leading-none">
                {user?.name || 'Admin'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {user?.email}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <ThemeToggle className="h-7 w-7" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => signOut({ callbackUrl: '/auth/login' })}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

function NavItem({
  href, icon: Icon, label, active,
}: {
  href: string; icon: React.ElementType; label: string; active: boolean;
}) {
  return (
    <Link href={href}>
      <div className={cn('nav-item', active && 'active')}>
        <Icon
          className={cn(
            'h-4 w-4 flex-shrink-0',
            active ? 'text-foreground' : 'text-muted-foreground'
          )}
          strokeWidth={active ? 2 : 1.5}
        />
        <span className={active ? 'text-foreground' : ''}>{label}</span>
        {active && <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />}
      </div>
    </Link>
  );
}
