import type { Metadata } from "next";
import { AuthCard } from "@/components/shared/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Recuperar contraseña" description="Te enviaremos un enlace para elegir una nueva contraseña.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
