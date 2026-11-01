import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initialsOf } from "@/components/shared/initials-avatar";
import { getTaskCounts } from "@/features/tasks/queries";
import { getCurrentUser } from "@/lib/auth";
import { UserMenuDropdown } from "./user-menu-dropdown";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenuDropdown name={user.fullName} email={user.email} initials={initialsOf(user.fullName)} />;
}

/** Acceso a seguimientos vencidos; el punto indica que hay alguno (dato real de tareas). */
export async function OverdueBell() {
  const { overdue } = await getTaskCounts();
  const label = overdue ? `${overdue} ${overdue === 1 ? "seguimiento vencido" : "seguimientos vencidos"}` : "Sin seguimientos vencidos";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/tasks?view=overdue"
          aria-label={label}
          className="relative flex size-10 items-center justify-center rounded-full border border-border bg-white/[0.04] text-muted-foreground transition-colors duration-200 outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BellIcon className="size-[18px]" aria-hidden />
          {overdue ? <span className="absolute top-2 right-2.5 size-2 rounded-full bg-[#ff8a4c] ring-2 ring-background" aria-hidden /> : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
