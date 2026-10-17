import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Introduce tu nombre").max(120, "Máximo 120 caracteres"),
  timezone: z.string().trim().refine(isValidTimeZone, "Zona horaria no válida"),
});

export type ProfileInput = z.input<typeof profileSchema>;
