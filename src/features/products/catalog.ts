/**
 * Catálogo de productos. La fuente única es la tabla `products` (migración
 * 20261018000200); aquí solo hay tipos y utilidades compartidas por cliente y servidor.
 * Para añadir un producto: nueva migración con un INSERT en `products`.
 */
export type Product = { code: string; label: string; active: boolean };

export const PRODUCT_CODE_RE = /^[a-z0-9_]{1,40}$/;

/** Opciones para un desplegable: productos activos y, si se indica, el valor actual aunque esté inactivo. */
export function productOptions(products: readonly Product[], current?: string | null) {
  return products.filter((p) => p.active || p.code === current).map((p) => ({ value: p.code, label: p.label }));
}

/** Etiqueta para mostrar una póliza: la del catálogo o, si es antigua y está fuera de catálogo, su nombre original. */
export function productLabel(products: readonly Product[], code: string | null | undefined, fallbackName?: string | null) {
  const found = code ? products.find((p) => p.code === code) : undefined;
  return found?.label ?? fallbackName ?? "—";
}

function canon(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^seguros? (de |del )?/, "")
    .trim();
}

/** Busca un producto del catálogo por código o etiqueta (sin mayúsculas ni tildes; admite "Seguro de …"). */
export function matchProduct(products: readonly Product[], raw: string): Product | null {
  const v = canon(raw);
  if (!v) return null;
  return products.find((p) => p.active && (p.code === v || canon(p.label) === v)) ?? null;
}
