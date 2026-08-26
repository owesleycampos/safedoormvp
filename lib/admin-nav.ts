/**
 * Single source of truth for the school admin navigation.
 *
 * The sidebar, the mobile drawer and the bottom bar each kept their own
 * hand-maintained array. They had already drifted: the drawer listed nine
 * items, the sidebar eight plus a separate Settings link, the bottom bar four
 * — and none of the three listed Dispositivos, which is where a tablet is
 * registered and its API key copied. That screen was reachable only by typing
 * the URL.
 */
import {
  LayoutDashboard, Video, ScanFace, GraduationCap,
  Users, UserCheck, ClipboardList,
  Smartphone, Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Short label for the bottom bar, where horizontal space is tight. */
  short?: string;
  /** Shown in the bottom bar on phones. */
  primary?: boolean;
}

/** Day-to-day operation. */
export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard',         primary: true },
  { href: '/admin/camera',       icon: Video,           label: 'Câmera ao Vivo',    short: 'Câmera', primary: true },
  { href: '/admin/unrecognized', icon: ScanFace,        label: 'Não Identificados' },
  { href: '/admin/students',     icon: GraduationCap,   label: 'Alunos',            primary: true },
  { href: '/admin/classes',      icon: Users,           label: 'Turmas' },
  { href: '/admin/parents',      icon: UserCheck,       label: 'Responsáveis' },
  { href: '/admin/attendance',   icon: ClipboardList,   label: 'Frequência',        primary: true },
  // Grade Escolar congelada: presença por aula é um sub-produto que a câmera
  // no portão não consegue alimentar (subjectId/period nunca são gravados) e
  // nenhum relatório consome. A rota /admin/subjects continua acessível por
  // URL para quem já a usava; volta à navegação quando houver leitor real.
];

/** Setup and configuration, separated by a divider in the sidebar. */
export const ADMIN_NAV_SECONDARY: NavItem[] = [
  { href: '/admin/devices',  icon: Smartphone, label: 'Dispositivos' },
  { href: '/admin/settings', icon: Settings,   label: 'Configurações' },
];

export const ADMIN_NAV_ALL: NavItem[] = [...ADMIN_NAV, ...ADMIN_NAV_SECONDARY];

/** Items shown in the phone bottom bar. */
export const ADMIN_NAV_PRIMARY: NavItem[] = ADMIN_NAV.filter((i) => i.primary);

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}
