"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

type SidebarProps = { onNavigate?: () => void };

function SidebarLinks({ pathname, onNavigate }: SidebarProps & { pathname: string | null }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname ? isActive(pathname, item.href) : false;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarWithPath(props: SidebarProps) {
  return <SidebarLinks {...props} pathname={usePathname()} />;
}

/** El resaltado de la ruta activa depende de la URL, así que se resuelve tras un Suspense. */
export function SidebarNav(props: SidebarProps) {
  return (
    <Suspense fallback={<SidebarLinks {...props} pathname={null} />}>
      <SidebarWithPath {...props} />
    </Suspense>
  );
}

function BottomLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Navegación rápida"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.filter((i) => i.mobile).map((item) => {
          const active = pathname ? isActive(pathname, item.href) : false;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BottomWithPath() {
  return <BottomLinks pathname={usePathname()} />;
}

export function MobileBottomNav() {
  return (
    <Suspense fallback={<BottomLinks pathname={null} />}>
      <BottomWithPath />
    </Suspense>
  );
}
