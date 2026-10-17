import { BarChart3Icon, CalendarCheckIcon, HomeIcon, SettingsIcon, UploadIcon, UsersIcon, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; shortLabel: string; icon: LucideIcon; mobile: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Para hoy", shortLabel: "Hoy", icon: HomeIcon, mobile: true },
  { href: "/leads", label: "Fichas", shortLabel: "Fichas", icon: UsersIcon, mobile: true },
  { href: "/tasks", label: "Seguimientos", shortLabel: "Tareas", icon: CalendarCheckIcon, mobile: true },
  { href: "/reports", label: "Informes", shortLabel: "Informes", icon: BarChart3Icon, mobile: true },
  { href: "/leads/import", label: "Importar CSV", shortLabel: "Importar", icon: UploadIcon, mobile: false },
  { href: "/settings", label: "Ajustes", shortLabel: "Ajustes", icon: SettingsIcon, mobile: false },
];

export function isActive(pathname: string, href: string) {
  if (href === "/leads") return pathname === "/leads" || (pathname.startsWith("/leads/") && !pathname.startsWith("/leads/import"));
  return pathname === href || pathname.startsWith(`${href}/`);
}
