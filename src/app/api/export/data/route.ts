import { getCurrentUser } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const PAGE = 1000;
type Table = "leads" | "activities" | "tasks" | "policies";

/** Exportación completa de los datos del usuario (derecho de acceso/portabilidad). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  const supabase = await createClient();

  async function fetchAll(table: Table) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select("*").eq("user_id", user!.id).order("created_at").order("id").range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }

  try {
    const [profile, leads, activities, tasks, policies] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      fetchAll("leads"),
      fetchAll("activities"),
      fetchAll("tasks"),
      fetchAll("policies"),
    ]);
    const body = JSON.stringify(
      { exported_at: new Date().toISOString(), profile: profile.data, leads, activities, tasks, policies },
      null,
      2,
    );
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mis-datos-${todayInTimeZone(user.timezone)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("No se pudieron exportar los datos", { status: 500 });
  }
}
