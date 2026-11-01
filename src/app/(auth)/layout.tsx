import { Brand } from "@/components/app-shell/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-10">
      <Brand href="/login" />
      <main className="w-full max-w-sm">{children}</main>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Herramienta independiente para comerciales. No está afiliada a ninguna compañía aseguradora.
      </p>
    </div>
  );
}
