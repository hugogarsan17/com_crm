import { describe, expect, it } from "vitest";
import { classifyTask } from "@/features/tasks/buckets";
import { adjacentMonths, bucketFor, conversionRate, formatMonth, resolvePeriod } from "./period";

const TZ = "Europe/Madrid";
const NOW = new Date("2026-10-17T10:00:00Z");

describe("periodos de informes", () => {
  it("resuelve los periodos predefinidos", () => {
    expect(resolvePeriod({}, TZ, NOW)).toMatchObject({ preset: "this_month", from: "2026-10-01", to: "2026-10-17", bucket: "day" });
    expect(resolvePeriod({ period: "last_month" }, TZ, NOW)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod({ period: "this_week" }, TZ, NOW)).toMatchObject({ from: "2026-10-12" });
    expect(resolvePeriod({ period: "this_year" }, TZ, NOW)).toMatchObject({ from: "2026-01-01", bucket: "month" });
  });

  it("valida periodos personalizados", () => {
    expect(resolvePeriod({ period: "custom", from: "2026-05-10", to: "2026-05-01" }, TZ, NOW)).toMatchObject({
      from: "2026-05-01",
      to: "2026-05-10",
    });
    expect(resolvePeriod({ period: "custom", from: "basura", to: "2026-05-01" }, TZ, NOW).preset).toBe("this_month");
    expect(resolvePeriod({ period: "desconocido" }, TZ, NOW).preset).toBe("this_month");
  });

  it("elige la granularidad del gráfico", () => {
    expect(bucketFor("2026-01-01", "2026-01-31")).toBe("day");
    expect(bucketFor("2026-01-01", "2026-03-31")).toBe("week");
    expect(bucketFor("2026-01-01", "2026-12-31")).toBe("month");
  });

  it("calcula la conversión sin dividir por cero", () => {
    expect(conversionRate(1, 4)).toBe(0.25);
    expect(conversionRate(0, 0)).toBeNull();
  });
});

describe("clasificación de seguimientos", () => {
  it("separa vencidas, hoy y próximas según el día local", () => {
    expect(classifyTask("2026-10-16T21:00:00Z", "pending", TZ, NOW)).toBe("overdue"); // 16 oct 23:00 Madrid
    expect(classifyTask("2026-10-16T22:30:00Z", "pending", TZ, NOW)).toBe("today"); // 17 oct 00:30
    expect(classifyTask("2026-10-17T22:00:00Z", "pending", TZ, NOW)).toBe("upcoming");
    expect(classifyTask("2026-10-01T10:00:00Z", "completed", TZ, NOW)).toBe("completed");
  });
});

describe("periodo mensual del panel", () => {
  const TZ = "Europe/Madrid";
  const NOW = new Date("2026-11-01T00:30:00Z"); // 1 de noviembre, 01:30 en Madrid

  it("por defecto es el mes en curso en la zona del usuario", () => {
    const p = resolvePeriod({}, TZ, NOW);
    expect(p).toMatchObject({ preset: "this_month", from: "2026-11-01", to: "2026-11-01", month: "2026-11" });
  });

  it("permite consultar meses anteriores completos", () => {
    expect(resolvePeriod({ period: "month", month: "2026-09" }, TZ, NOW)).toMatchObject({
      preset: "month",
      from: "2026-09-01",
      to: "2026-09-30",
      month: "2026-09",
    });
    expect(resolvePeriod({ period: "month", month: "2024-02" }, TZ, NOW).to).toBe("2024-02-29");
  });

  it("ignora meses futuros o mal formados", () => {
    expect(resolvePeriod({ period: "month", month: "2026-12" }, TZ, NOW).preset).toBe("this_month");
    expect(resolvePeriod({ period: "month", month: "2026-13" }, TZ, NOW).preset).toBe("this_month");
  });

  it("navega entre meses sin pasar del actual", () => {
    expect(adjacentMonths("2026-11", "2026-11")).toEqual({ prev: "2026-10", next: null });
    expect(adjacentMonths("2026-01", "2026-11")).toEqual({ prev: "2025-12", next: "2026-02" });
    expect(formatMonth("2026-10")).toBe("octubre de 2026");
  });
});
