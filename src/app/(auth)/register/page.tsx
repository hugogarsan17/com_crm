import type { Metadata } from "next";
import { AuthCard } from "@/components/shared/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <AuthCard title="Crear cuenta" description="Empieza a organizar tu cartera de clientes.">
      <RegisterForm />
    </AuthCard>
  );
}
