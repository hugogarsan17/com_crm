import Link from "next/link";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { getCurrentUser } from "@/lib/auth";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const initials =
    user.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="flex items-center gap-2">
      <Link href="/settings" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 hover:bg-muted">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden>
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.fullName}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <SettingsIcon className="sr-only" />
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOutIcon />
        </Button>
      </form>
    </div>
  );
}
