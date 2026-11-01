import { Suspense } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brand } from "@/components/app-shell/brand";
import { MobileBottomNav, SideRail, TopNav } from "@/components/app-shell/nav";
import { OverdueBell, UserMenu } from "@/components/app-shell/user-menu";

function HeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <Suspense fallback={<Skeleton className="size-10 rounded-full" />}>
        <OverdueBell />
      </Suspense>
      <Suspense fallback={<Skeleton className="size-10 rounded-full" />}>
        <UserMenu />
      </Suspense>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 lg:grid lg:h-20 lg:grid-cols-[1fr_auto_1fr] lg:px-8">
          <Brand />
          <div className="hidden lg:block">
            <TopNav />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button asChild size="icon-lg" className="lg:hidden" aria-label="Nueva ficha">
              <Link href="/leads/new">
                <PlusIcon aria-hidden />
              </Link>
            </Button>
            <HeaderActions />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 lg:px-8">
        <aside className="sticky top-24 hidden h-fit shrink-0 lg:block">
          <SideRail />
        </aside>
        <main className="min-w-0 flex-1 pt-4 pb-32 lg:pt-2 lg:pb-12">{children}</main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
