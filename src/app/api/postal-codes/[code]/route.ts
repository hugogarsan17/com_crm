import { lookupPostalCode } from "@/features/postal-codes/lookup";
import { getCurrentUser } from "@/lib/auth";

/** Localidad para un código postal (solo usuarios con sesión, para no exponer un proxy abierto). */
export async function GET(_request: Request, { params }: RouteContext<"/api/postal-codes/[code]">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  const { code } = await params;
  if (code.length > 10) return Response.json({ error: "Código postal no válido" }, { status: 400 });
  const result = await lookupPostalCode(decodeURIComponent(code));
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=86400" } });
}
