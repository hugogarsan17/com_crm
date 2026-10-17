import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Introduce un email válido"));

export const PASSWORD_MIN = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(72, "La contraseña admite como máximo 72 caracteres")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "La contraseña debe incluir letras y números");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Introduce tu contraseña"),
});

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Introduce tu nombre").max(120, "Máximo 120 caracteres"),
    email,
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Las contraseñas no coinciden",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Las contraseñas no coinciden",
  });

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
