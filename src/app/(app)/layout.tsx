import { Suspense } from "react";
import Link from "next/link";
import { PlusIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileMenu } from "@/components/app-shell/mobile-menu";
import { MobileBottomNav, SidebarNav } from "@/components/app-shell/nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { APP_NAME } from "@/lib/app";

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShieldCheckIcon className="size-4" aria-hidden />
      </span>
      {APP_NAME}
    </Link>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-svh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh flex-col gap-6 border-r bg-muted/30 p-4 md:flex">
        <Brand />
        <Button asChild>
          <Link href="/leads/new">
            <PlusIcon aria-hidden /> Nueva ficha
          </Link>
        </Button>
        <SidebarNav />
        <div className="mt-auto border-t pt-4">
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/95 px-2 py-1.5 backdrop-blur md:hidden">
          <div className="flex items-center gap-1">
            <MobileMenu
              footer={
                <Suspense fallback={<Skeleton className="h-10 w-full" />}>
                  <UserMenu />
                </Suspense>
              }
            />
            <Brand />
          </div>
          <Button asChild size="lg">
            <Link href="/leads/new">
              <PlusIcon aria-hidden /> Nueva
            </Link>
          </Button>
        </header>
        <main className="flex-1 px-4 pt-5 pb-28 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
