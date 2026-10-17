import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/types/database.types";

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/auth"];
/** Rutas de autenticación de las que se redirige al panel si ya hay sesión. */
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectTo(request: NextRequest, pathname: string, response: NextResponse, search?: URLSearchParams) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search ? `?${search.toString()}` : "";
  const redirect = NextResponse.redirect(url);
  // Conserva las cookies de sesión refrescadas.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

/**
 * Refresca la sesión de Supabase en cada petición y aplica redirecciones
 * optimistas. La autorización real se valida en servidor y en RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isPublic = matches(pathname, PUBLIC_PATHS);

  if (!isSupabaseConfigured()) {
    return isPublic ? response : redirectTo(request, "/login", response);
  }

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // No ejecutar código entre createServerClient y getClaims(): getClaims valida el JWT
  // y refresca la sesión si ha caducado.
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims?.sub ?? null;
  } catch {
    userId = null;
  }

  if (!userId && !isPublic && !pathname.startsWith("/api/")) {
    const search = new URLSearchParams();
    if (pathname !== "/") search.set("next", `${pathname}${request.nextUrl.search}`);
    return redirectTo(request, "/login", response, search);
  }

  if (userId && (matches(pathname, GUEST_ONLY_PATHS) || pathname === "/")) {
    return redirectTo(request, "/dashboard", response);
  }

  return response;
}
