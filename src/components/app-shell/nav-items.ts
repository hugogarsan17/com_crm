import {
  BarChart3Icon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  DownloadIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
  UploadIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; shortLabel: string; icon: LucideIcon };

/** Secciones principales: cápsula central en escritorio y barra inferior en móvil. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Para hoy", shortLabel: "Hoy", icon: HomeIcon },
  { href: "/leads", label: "Fichas", shortLabel: "Fichas", icon: UsersIcon },
  { href: "/tasks", label: "Seguimientos", shortLabel: "Tareas", icon: CalendarCheckIcon },
  { href: "/calendar", label: "Calendario", shortLabel: "Agenda", icon: CalendarDaysIcon },
  { href: "/reports", label: "Informes", shortLabel: "Informes", icon: BarChart3Icon },
];

export type ActionItem = { href: string; label: string; icon: LucideIcon; download?: boolean };

/** Accesos secundarios: barra lateral de iconos en escritorio y menú de perfil en móvil. */
export const ACTION_ITEMS: ActionItem[] = [
  { href: "/leads/new", label: "Nueva ficha", icon: PlusIcon },
  { href: "/leads/import", label: "Importar CSV", icon: UploadIcon },
  { href: "/api/export/leads", label: "Exportar fichas (CSV)", icon: DownloadIcon, download: true },
];

export const SETTINGS_ITEM: ActionItem = { href: "/settings", label: "Ajustes", icon: SettingsIcon };

export function isActive(pathname: string, href: string) {
  if (href === "/leads")
    return pathname === "/leads" || (pathname.startsWith("/leads/") && !pathname.startsWith("/leads/import") && !pathname.startsWith("/leads/new"));
  return pathname === href || pathname.startsWith(`${href}/`);
}
