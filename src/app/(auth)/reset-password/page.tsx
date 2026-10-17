import type { Metadata } from "next";
import { AuthCard } from "@/components/shared/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

// Requiere la sesión temporal creada por el enlace de recuperación (/auth/confirm).
// El proxy redirige a /login si no hay sesión.
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Elige una nueva contraseña">
      <ResetPasswordForm />
    </AuthCard>
  );
}
