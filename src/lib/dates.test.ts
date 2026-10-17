import { describe, expect, it } from "vitest";
import {
  addDaysKeepingLocalTime,
  dayBoundsInTimeZone,
  isoToLocalDateTime,
  isValidLocalDate,
  isValidLocalDateTime,
  localDateTimeFromNow,
  localDateTimeToIso,
  todayInTimeZone,
} from "./dates";

const TZ = "Europe/Madrid";

describe("fechas con zona horaria", () => {
  it("valida fechas locales reales", () => {
    expect(isValidLocalDate("2026-02-28")).toBe(true);
    expect(isValidLocalDate("2026-02-30")).toBe(false);
    expect(isValidLocalDateTime("2026-10-17T09:30")).toBe(true);
    expect(isValidLocalDateTime("2026-10-17T24:00")).toBe(false);
    expect(isValidLocalDateTime("17/10/2026 09:30")).toBe(false);
  });

  it("convierte hora local de Madrid a UTC en verano e invierno", () => {
    expect(localDateTimeToIso("2026-07-01T10:00", TZ)).toBe("2026-07-01T08:00:00.000Z");
    expect(localDateTimeToIso("2026-12-01T10:00", TZ)).toBe("2026-12-01T09:00:00.000Z");
  });

  it("ida y vuelta ISO ↔ datetime-local", () => {
    expect(isoToLocalDateTime("2026-07-01T08:00:00.000Z", TZ)).toBe("2026-07-01T10:00");
    expect(isoToLocalDateTime(null, TZ)).toBe("");
  });

  it("calcula los límites del día local", () => {
    const now = new Date("2026-10-16T23:30:00Z"); // ya es 17 en Madrid (UTC+2)
    expect(todayInTimeZone(TZ, now)).toBe("2026-10-17");
    const { start, end } = dayBoundsInTimeZone(TZ, now);
    expect(start.toISOString()).toBe("2026-10-16T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-17T22:00:00.000Z");
  });

  it("pospone días manteniendo la hora local aunque cambie el horario de verano", () => {
    // 24 oct 2026 10:00 (UTC+2) + 2 días → 26 oct 10:00 (UTC+1)
    expect(addDaysKeepingLocalTime("2026-10-24T08:00:00.000Z", 2, TZ)).toBe("2026-10-26T09:00:00.000Z");
  });

  it("genera un datetime-local relativo", () => {
    expect(localDateTimeFromNow(TZ, 1, 10, new Date("2026-10-17T12:00:00Z"))).toBe("2026-10-18T10:00");
  });
});
