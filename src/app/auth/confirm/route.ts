import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Destino de los enlaces de email de Supabase (confirmación y recuperación).
 * Admite plantillas con token_hash (recomendado para SSR) y el flujo PKCE con `code`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let failed = true;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (failed) {
    target.pathname = "/auth/error";
  } else {
    const [path, query] = next.split("?");
    target.pathname = path;
    if (query) target.search = `?${query}`;
  }
  return NextResponse.redirect(target);
}
