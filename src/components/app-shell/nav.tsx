"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ACTION_ITEMS, isActive, NAV_ITEMS, SETTINGS_ITEM, type ActionItem } from "./nav-items";

/** El resaltado de la ruta activa depende de la URL, así que se resuelve tras un Suspense. */
function withPathname<P extends object>(Component: (props: P & { pathname: string | null }) => ReactNode) {
  function WithPath(props: P) {
    return <Component {...props} pathname={usePathname()} />;
  }
  return function PathAware(props: P) {
    return (
      <Suspense fallback={<Component {...props} pathname={null} />}>
        <WithPath {...props} />
      </Suspense>
    );
  };
}

function TopLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Principal" className="rounded-full border border-border bg-black/30 p-1 shadow-soft backdrop-blur-xl">
      <ul className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname ? isActive(pathname, item.href) : false;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "bg-surface-hover text-foreground shadow-sm" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const TopNav = withPathname<object>(TopLinks);

function RailLink({ item, active }: { item: ActionItem; active: boolean }) {
  const cls = cn(
    "flex size-10 items-center justify-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active ? "bg-surface-hover text-foreground" : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
  );
  const icon = <item.icon className="size-[18px]" aria-hidden />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {item.download ? (
          <a href={item.href} className={cls} aria-label={item.label}>
            {icon}
          </a>
        ) : (
          <Link href={item.href} className={cls} aria-label={item.label} aria-current={active ? "page" : undefined}>
            {icon}
          </Link>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function RailLinks({ pathname }: { pathname: string | null }) {
  const active = (href: string) => (pathname ? isActive(pathname, href) : false);
  return (
    <nav
      aria-label="Accesos rápidos"
      className="flex flex-col items-center gap-1 rounded-full border border-border bg-black/30 px-1.5 py-3 shadow-soft backdrop-blur-xl"
    >
      {ACTION_ITEMS.map((item) => (
        <RailLink key={item.href} item={item} active={!item.download && active(item.href)} />
      ))}
      <span className="my-2 h-px w-6 bg-border" aria-hidden />
      <RailLink item={SETTINGS_ITEM} active={active(SETTINGS_ITEM.href)} />
    </nav>
  );
}

export const SideRail = withPathname<object>(RailLinks);

function BottomLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Navegación rápida"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-full border border-border bg-[#161915]/90 p-1 shadow-2xl backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = pathname ? isActive(pathname, item.href) : false;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors duration-200",
                  active ? "bg-surface-hover text-foreground" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("size-5", active && "text-primary")} aria-hidden />
                {item.shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const MobileBottomNav = withPathname<object>(BottomLinks);
