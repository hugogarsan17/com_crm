import "server-only";
import { requireUser } from "@/lib/auth";
import type { Product } from "./catalog";

/** Catálogo completo (activos e inactivos), en el orden definido. */
export async function getProducts(): Promise<Product[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("products").select("code, label, active").order("sort_order").order("label");
  if (error) throw new Error("No se pudo cargar el catálogo de productos.");
  return data;
}
