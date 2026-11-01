"use client";

import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/auth/actions";
import { ACTION_ITEMS, SETTINGS_ITEM } from "./nav-items";

export function UserMenuDropdown({ name, email, initials }: { name: string; email: string; initials: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menú de usuario"
        className="flex size-10 items-center justify-center rounded-full bg-[#e6f5c4] text-sm font-semibold text-[#2b3a10] ring-1 ring-white/10 transition-shadow duration-200 outline-none hover:ring-white/30 focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col px-2.5 py-2">
          <span className="truncate text-sm font-medium text-foreground">{name || "Mi cuenta"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* En móvil no hay barra lateral: los accesos secundarios viven aquí. */}
        {ACTION_ITEMS.map((item) => (
          <DropdownMenuItem key={item.href} asChild className="lg:hidden">
            {item.download ? (
              <a href={item.href}>
                <item.icon aria-hidden /> {item.label}
              </a>
            ) : (
              <Link href={item.href}>
                <item.icon aria-hidden /> {item.label}
              </Link>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href={SETTINGS_ITEM.href}>
            <SETTINGS_ITEM.icon aria-hidden /> {SETTINGS_ITEM.label}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          {/* Se evita el cierre inmediato del menú para que el envío del formulario no se pierda. */}
          <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
            <button type="submit" className="w-full">
              <LogOutIcon aria-hidden /> Cerrar sesión
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
