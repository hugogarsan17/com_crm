import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone, normalizeReference, sanitizeSearchTerm } from "./normalize";
import { safeNextPath } from "./redirect";
import { csvCell, toCsv } from "./csv";

describe("normalización para duplicados", () => {
  it("normaliza teléfonos españoles", () => {
    expect(normalizePhone("+34 600 12 34 56")).toBe("600123456");
    expect(normalizePhone("0034600123456")).toBe("600123456");
    expect(normalizePhone("600-123-456")).toBe("600123456");
    expect(normalizePhone("+44 20 7946 0958")).toBe("442079460958");
    expect(normalizePhone("")).toBeNull();
  });

  it("normaliza email y referencia", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com");
    expect(normalizeReference(" REF-01 ")).toBe("ref-01");
    expect(normalizeEmail(null)).toBeNull();
  });

  it("limpia caracteres que romperían el filtro de búsqueda", () => {
    expect(sanitizeSearchTerm("ana, (garcía)")).toBe("ana garcía");
    expect(sanitizeSearchTerm('%_"*')).toBe("");
  });
});

describe("redirecciones seguras", () => {
  it("solo acepta rutas internas", () => {
    expect(safeNextPath("/leads/1")).toBe("/leads/1");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});

describe("exportación CSV", () => {
  it("escapa separadores y evita inyección de fórmulas", () => {
    expect(csvCell('a;"b"')).toBe('"a;""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(12.5)).toBe("12,5");
    expect(toCsv(["a"], [[null]]).startsWith("﻿a\r\n")).toBe(true);
  });
});
