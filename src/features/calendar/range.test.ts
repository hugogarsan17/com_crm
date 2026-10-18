import { describe, expect, it } from "vitest";
import { classifyTask } from "@/features/tasks/buckets";
import { calendarTitle, groupTasksByDay, parseCalendarParams, resolveCalendarRange } from "./range";

const TZ = "Europe/Madrid";
const NOW = new Date("2026-10-18T09:00:00Z"); // domingo 18/10/2026, 11:00 en Madrid

describe("rangos del calendario", () => {
  it("semana de lunes a domingo en la zona del usuario", () => {
    const r = resolveCalendarRange("week", "2026-10-18", TZ, NOW);
    expect(r.days).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(r.startIso).toBe("2026-10-11T22:00:00.000Z"); // 00:00 en Madrid (CEST)
    expect(r.endIso).toBe("2026-10-18T22:00:00.000Z");
    expect(r.prevDate).toBe("2026-10-11");
    expect(r.nextDate).toBe("2026-10-25");
  });

  it("mes completo con días de relleno y cambio de horario", () => {
    const r = resolveCalendarRange("month", "2026-10-05", TZ, NOW);
    expect(r.days[0]).toBe("2026-09-28");
    expect(r.days.at(-1)).toBe("2026-11-01");
    expect(r.days.length % 7).toBe(0);
    // El 25/10 termina el horario de verano: el fin del rango ya es CET (+01:00).
    expect(r.endIso).toBe("2026-11-01T23:00:00.000Z");
    expect(calendarTitle(r)).toBe("octubre de 2026");
  });

  it("día y parámetros por defecto", () => {
    expect(parseCalendarParams({}, TZ, NOW)).toEqual({ view: "week", date: "2026-10-18", today: "2026-10-18" });
    expect(parseCalendarParams({ view: "nope", date: "2026-02-30" }, TZ, NOW).date).toBe("2026-10-18");
    const r = resolveCalendarRange("day", "2026-10-18", TZ, NOW);
    expect(r.days).toEqual(["2026-10-18"]);
  });

  it("agrupa por día local, no por día UTC", () => {
    const tasks = [
      { id: "b", due_at: "2026-10-18T21:30:00Z" }, // 23:30 del 18 en Madrid
      { id: "a", due_at: "2026-10-18T22:30:00Z" }, // 00:30 del 19 en Madrid
      { id: "c", due_at: "2026-10-18T08:00:00Z" },
    ];
    const byDay = groupTasksByDay(tasks, TZ);
    expect(byDay.get("2026-10-18")?.map((t) => t.id)).toEqual(["c", "b"]);
    expect(byDay.get("2026-10-19")?.map((t) => t.id)).toEqual(["a"]);
  });

  it("una tarea de hoy del calendario es también una tarea de «Para hoy»", () => {
    const task = { id: "t1", due_at: "2026-10-18T16:00:00Z", status: "pending" as const };
    const week = resolveCalendarRange("week", "2026-10-18", TZ, NOW);
    expect(groupTasksByDay([task], TZ).get(week.today)).toHaveLength(1);
    // «Para hoy» (dashboard) usa classifyTask/dayBoundsInTimeZone con la misma zona.
    expect(classifyTask(task.due_at, task.status, TZ, NOW)).toBe("today");
  });
});
