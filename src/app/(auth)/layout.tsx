import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";
import { APP_NAME } from "@/lib/app";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Link href="/login" className="flex items-center gap-2 text-lg font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheckIcon className="size-5" aria-hidden />
        </span>
        {APP_NAME}
      </Link>
      <main className="w-full max-w-sm">{children}</main>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Herramienta independiente para comerciales. No está afiliada a ninguna compañía aseguradora.
      </p>
    </div>
  );
}
