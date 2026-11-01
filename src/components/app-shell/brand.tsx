import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";
import { APP_NAME } from "@/lib/app";

export function Brand({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-2.5 rounded-full pr-2 text-[1.05rem] font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_20px_-8px_rgb(196_245_83/0.7)]">
        <ShieldCheckIcon className="size-5" aria-hidden />
      </span>
      {APP_NAME}
    </Link>
  );
}
