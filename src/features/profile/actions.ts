"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { error } = await ctx.supabase.from("profiles").update(parsed.data).eq("id", ctx.user.id);
  if (error) return fail(databaseErrorMessage(error));
  refresh();
  return ok(undefined, "Perfil actualizado");
}

/** Elimina la cuenta y todos sus datos (cascada en la base de datos). */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  if (confirmation.trim().toUpperCase() !== "ELIMINAR") return fail("Escribe ELIMINAR para confirmar.");
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { error } = await ctx.supabase.rpc("delete_my_account");
  if (error) return fail(databaseErrorMessage(error));
  await ctx.supabase.auth.signOut();
  redirect("/login?notice=deleted");
}
