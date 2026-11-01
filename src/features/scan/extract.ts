import type { FuneralInsurance } from "@/features/leads/constants";
import type { Product } from "@/features/products/catalog";
import { isSpanishPostalCode } from "@/features/postal-codes/spain";
import { isValidEmail, isValidPhone } from "@/lib/validation/common";

/** Campos de la ficha que se pueden deducir de un documento escaneado. */
export type ScannedLead = {
  full_name?: string;
  phone?: string;
  email?: string;
  postal_code?: string;
  locality?: string;
  customer_reference?: string;
  has_funeral_insurance?: Exclude<FuneralInsurance, "unknown">;
  product_code?: string;
};

export const SCANNED_FIELD_LABELS: Record<keyof ScannedLead, string> = {
  full_name: "Nombre y apellidos",
  phone: "Teléfono",
  email: "Email",
  postal_code: "Código postal",
  locality: "Localidad",
  customer_reference: "Número de póliza",
  has_funeral_insurance: "Seguro de decesos",
  product_code: "Producto",
};

// Etiquetas habituales en fichas de clientes (se comparan sin tildes y en minúsculas).
const NAME_LABELS = ["nombre y apellidos", "nombre completo", "apellidos y nombre", "tomador", "titular", "asegurado", "cliente", "nombre"];
const SURNAME_LABELS = ["apellidos", "primer apellido"];
const PHONE_LABELS = ["telefono movil", "telefono", "movil", "tel", "tlf", "tfno"];
const EMAIL_LABELS = ["correo electronico", "email", "e-mail", "correo"];
const POSTAL_LABELS = ["codigo postal", "cod. postal", "c.p.", "cp"];
const LOCALITY_LABELS = ["localidad", "poblacion", "municipio", "ciudad"];
const POLICY_LABELS = ["numero de poliza", "n de poliza", "no de poliza", "nº de poliza", "n poliza", "nº poliza", "poliza n", "poliza", "referencia", "ref."];
const FUNERAL_LABELS = ["seguro de decesos", "decesos"];
const PRODUCT_LABELS = ["producto a ofrecer", "producto", "ramo"];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Teléfonos españoles: prefijo opcional y 9 dígitos que empiezan por 6, 7, 8 o 9, con separadores variados.
const PHONE_RE = /(?:\+|00)?(?:34[\s.-]?)?[6789](?:[\s.-]?\d){8}\b/;
const POSTAL_RE = /\b\d{5}\b/;

/** Minúsculas, sin tildes y con la misma longitud que el texto original (NFC). */
function fold(value: string) {
  return value
    .normalize("NFC")
    .split("")
    .map((ch) => ch.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0) || ch)
    .join("")
    .toLowerCase();
}

function clean(value: string) {
  return value.replace(/[|_]+/g, " ").replace(/\s+/g, " ").replace(/^[\s:.\-–]+|[\s:.\-–]+$/g, "").trim();
}

/** Corta el valor donde empieza otro campo en la misma línea («Ana López   Teléfono: 600…»). */
function untilNextLabel(value: string) {
  return value.split(/\s+(?=[\p{L}][\p{L} .º]{1,30}:)/u)[0];
}

/**
 * Valor de un campo etiquetado: «Etiqueta: valor», «Etiqueta valor» o la etiqueta
 * sola en una línea con el valor en la siguiente. La etiqueta debe abrir la línea
 * o ir seguida de «:» (así «Ficha de cliente» no se toma por el campo «Cliente»).
 */
function labeled(lines: string[], labels: string[]): string | undefined {
  const sorted = [...labels].sort((a, b) => b.length - a.length);
  for (let i = 0; i < lines.length; i++) {
    const original = lines[i].normalize("NFC");
    const folded = fold(original);
    for (const label of sorted) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match =
        new RegExp(`^[^a-z0-9]*(${escaped})(?![a-z])`).exec(folded) ?? new RegExp(`(?:^|[^a-z])(${escaped})\\s*:`).exec(folded);
      if (!match) continue;
      const start = match.index + match[0].indexOf(match[1]) + label.length;
      const rest = clean(untilNextLabel(original.slice(start)));
      if (rest) return rest;
      // Valor en la línea siguiente, salvo que esa línea sea otro campo («Teléfono: …»).
      const following = lines[i + 1] ?? "";
      const next = /^[\p{L}][\p{L} .º]{1,30}:/u.test(following) ? "" : clean(untilNextLabel(following));
      if (next) return next;
    }
  }
  return undefined;
}

function formatSpanishPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const local = digits.slice(-9);
  const grouped = `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return digits.length > 9 ? `+34 ${grouped}` : grouped;
}

function findPhone(text: string) {
  const match = text.match(PHONE_RE);
  if (!match) return undefined;
  const phone = formatSpanishPhone(match[0]);
  return isValidPhone(phone) ? phone : undefined;
}

// Caracteres en los que el OCR suele convertir la «@» (de más a menos probable).
const AT_LOOKALIKES = ["©", "®", "Q", "&", "G", "a", "O", "0"];

/**
 * Repara un email etiquetado al que el OCR le ha cambiado la «@» («ana.demoQexample.test»).
 * Solo se usa con el valor de la etiqueta «Email», nunca con texto libre.
 */
function repairEmail(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (compact.includes("@")) return compact;
  for (const ch of AT_LOOKALIKES) {
    // Se prueba de derecha a izquierda: el dominio suele ser más corto que la parte local.
    for (let i = compact.lastIndexOf(ch); i > 0; i = compact.lastIndexOf(ch, i - 1)) {
      const candidate = `${compact.slice(0, i)}@${compact.slice(i + 1)}`;
      if (/^[^@]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(candidate) && isValidEmail(candidate)) return candidate;
    }
  }
  return compact;
}

function findEmail(text: string) {
  // El OCR suele confundir «@» o meter espacios alrededor del punto.
  const candidate = text.replace(/\s*@\s*/g, "@").replace(/@([^\s]+)\s\.\s?/g, "@$1.").match(EMAIL_RE)?.[0];
  return candidate && isValidEmail(candidate) ? candidate.toLowerCase() : undefined;
}

/** Nombre propio en formato título, conservando partículas («de», «del», «la», «y») en minúscula. */
function titleCase(value: string) {
  const particles = new Set(["de", "del", "la", "las", "los", "y", "e"]);
  return value
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && particles.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function cleanName(value: string | undefined) {
  if (!value) return undefined;
  const name = clean(value.replace(/[^\p{L}\s'.-]/gu, " "));
  if (name.split(" ").filter((w) => w.length > 1).length === 0 || name.length > 120) return undefined;
  return name === name.toUpperCase() || name === name.toLowerCase() ? titleCase(name) : name;
}

function findFuneral(lines: string[]): ScannedLead["has_funeral_insurance"] {
  const value = labeled(lines, FUNERAL_LABELS);
  if (!value) return undefined;
  const v = fold(value);
  if (/^(si|sí|s|x|\[x\]|yes)\b/.test(v)) return "yes";
  if (/^(no|n)\b/.test(v)) return "no";
  return undefined;
}

function findProduct(lines: string[], products: Product[]) {
  const value = labeled(lines, PRODUCT_LABELS);
  if (!value) return undefined;
  const v = fold(value);
  return products.find((p) => p.active && (v.includes(fold(p.label)) || v.includes(p.code)))?.code;
}

/**
 * Deduce los datos de una ficha a partir del texto reconocido por OCR.
 * Solo devuelve valores que superan las mismas validaciones del formulario;
 * lo que no se reconoce con seguridad se deja vacío (nunca se inventa).
 */
export function extractLeadFields(text: string, products: Product[] = []): ScannedLead {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const result: ScannedLead = {};

  const name = labeled(lines, NAME_LABELS);
  const surname = labeled(lines, SURNAME_LABELS);
  // «Nombre: Ana» + «Apellidos: García» → «Ana García» (si el nombre no los incluye ya).
  const fullName = cleanName(name && surname && !fold(name).includes(fold(surname)) ? `${name} ${surname}` : (name ?? surname));
  if (fullName) result.full_name = fullName;

  const phone = findPhone(labeled(lines, PHONE_LABELS) ?? "") ?? findPhone(text);
  if (phone) result.phone = phone;

  const labeledEmail = labeled(lines, EMAIL_LABELS);
  const email = findEmail(labeledEmail ? repairEmail(labeledEmail) : "") ?? findEmail(text);
  if (email) result.email = email;

  // Código postal: el etiquetado o un número de 5 dígitos de provincia válida que no forme parte del teléfono ni de la póliza.
  const policyRaw = labeled(lines, POLICY_LABELS);
  const policy = policyRaw ? clean(policyRaw.split(/\s{2,}|\s(?=[A-Za-zÁÉÍÓÚáéíóú]{3,}:)/)[0]) : undefined;
  if (policy && /\d/.test(policy) && policy.length <= 80) result.customer_reference = policy.replace(/\s+/g, "");

  const labeledPostal = labeled(lines, POSTAL_LABELS)?.match(POSTAL_RE)?.[0];
  let textWithoutKnown = text.replace(PHONE_RE, " ");
  if (result.customer_reference) textWithoutKnown = textWithoutKnown.split(result.customer_reference).join(" ");
  const postal = [labeledPostal, ...(textWithoutKnown.match(/\b\d{5}\b/g) ?? [])].find((v) => v && isSpanishPostalCode(v));
  if (postal) result.postal_code = postal;

  const locality =
    labeled(lines, LOCALITY_LABELS) ??
    // «28001 Madrid» en la línea de la dirección.
    (postal ? lines.map((l) => l.match(new RegExp(`${postal}[\\s,-]+([\\p{L}][\\p{L}\\s'-]{1,60})`, "u"))?.[1]).find(Boolean) : undefined);
  const cleanLocality = locality ? clean(locality.replace(/\(.*?\)|[^\p{L}\s'-]/gu, " ")) : "";
  if (cleanLocality && cleanLocality.length <= 80) {
    result.locality = cleanLocality === cleanLocality.toUpperCase() ? titleCase(cleanLocality) : cleanLocality;
  }

  const funeral = findFuneral(lines);
  if (funeral) result.has_funeral_insurance = funeral;

  const product = findProduct(lines, products);
  if (product) result.product_code = product;

  return result;
}
