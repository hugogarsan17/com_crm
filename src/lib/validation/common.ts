import { z } from "zod";
import { isValidLocalDate, isValidLocalDateTime } from "@/lib/dates";

const emptyToNull = (v: string) => (v === "" ? null : v);

export const requiredText = (max: number, requiredMessage: string) =>
  z.string().trim().min(1, requiredMessage).max(max, `Máximo ${max} caracteres`);

export const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).transform(emptyToNull);

const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;

export function isValidPhone(value: string) {
  if (!PHONE_CHARS_RE.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 9 && digits <= 15;
}

export const PHONE_ERROR = "Teléfono no válido: entre 9 y 15 dígitos; se permiten +, espacios, guiones, puntos y paréntesis";

export const optionalPhone = z
  .string()
  .trim()
  .max(30, "Máximo 30 caracteres")
  .refine((v) => v === "" || isValidPhone(v), PHONE_ERROR)
  .transform(emptyToNull);

export const EMAIL_ERROR = "Introduce un email válido";

export function isValidEmail(value: string) {
  return value.length <= 254 && z.email().safeParse(value).success;
}

export const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidEmail(v), EMAIL_ERROR)
  .transform((v) => (v === "" ? null : v.toLowerCase()));

const MONEY_RE = /^\d{1,10}([.,]\d{1,2})?$/;

/** Convierte "1.234,56", "1234.56" o "1234,5" a número. Devuelve null si no es válido. */
export function parseMoney(raw: string): number | null {
  let v = raw.trim().replace(/\s|€/g, "");
  if (v === "") return null;
  // Formato español con separador de miles: 1.234,56
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v)) v = v.replace(/\./g, "");
  if (!MONEY_RE.test(v)) return null;
  return Math.round(Number(v.replace(",", ".")) * 100) / 100;
}

export const optionalMoney = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    if (v === "") return;
    if (v.startsWith("-")) {
      ctx.addIssue({ code: "custom", message: "El importe no puede ser negativo" });
    } else if (parseMoney(v) === null) {
      ctx.addIssue({ code: "custom", message: "Importe no válido (ejemplo: 125,50)" });
    }
  })
  .transform((v) => (v === "" ? null : parseMoney(v)));

export const localDateTime = z
  .string()
  .trim()
  .min(1, "Indica fecha y hora")
  .refine(isValidLocalDateTime, "Fecha y hora no válidas");

export const optionalLocalDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidLocalDateTime(v), "Fecha y hora no válidas")
  .transform(emptyToNull);

export const optionalLocalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidLocalDate(v), "Fecha no válida")
  .transform(emptyToNull);

export const uuid = z.uuid("Identificador no válido");

/** "Hogar, Auto; Vida" → ["Hogar", "Auto", "Vida"] sin duplicados. */
export function parseList(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw.split(/[,;\n|]/)) {
    const v = item.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export const listFromText = z
  .string()
  .transform(parseList)
  .refine((list) => list.length <= 30, "Máximo 30 elementos")
  .refine((list) => list.every((v) => v.length <= 80), "Cada elemento admite como máximo 80 caracteres");
