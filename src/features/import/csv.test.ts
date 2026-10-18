import { describe, expect, it } from "vitest";
import type { Product } from "@/features/products/catalog";
import {
  chunk,
  collectKeys,
  guessMapping,
  markDuplicates,
  parseFuneralInsurance,
  parseImportDate,
  parsePriority,
  summarize,
  validateRecords,
} from "./csv";

const TZ = "Europe/Madrid";
const PRODUCTS: Product[] = [
  { code: "decesos", label: "Decesos", active: true },
  { code: "hogar", label: "Hogar", active: true },
  { code: "vida", label: "Vida", active: true },
  { code: "antiguo", label: "Antiguo", active: false },
];

describe("importación CSV", () => {
  it("propone el mapeo a partir de cabeceras habituales", () => {
    const m = guessMapping([
      "Nombre y apellidos", "Teléfono", "Correo", "CP", "Población", "Número de póliza", "¿Tiene seguro de decesos?", "Producto", "Otra",
    ]);
    expect(m).toMatchObject({
      full_name: "Nombre y apellidos",
      phone: "Teléfono",
      email: "Correo",
      postal_code: "CP",
      locality: "Población",
      customer_reference: "Número de póliza",
      has_funeral_insurance: "¿Tiene seguro de decesos?",
      product: "Producto",
      notes: "",
    });
    // Los CSV antiguos con "Referencia" siguen mapeándose al número de póliza.
    expect(guessMapping(["Nombre", "Referencia"]).customer_reference).toBe("Referencia");
  });

  it("interpreta fechas y prioridades", () => {
    expect(parseImportDate("05/03/2026", TZ)).toBe("2026-03-05T08:00:00.000Z");
    expect(parseImportDate("2026-07-01 18:30", TZ)).toBe("2026-07-01T16:30:00.000Z");
    expect(parseImportDate("31/02/2026", TZ)).toBe("invalid");
    expect(parseImportDate("", TZ)).toBeNull();
    expect(parsePriority("Alta")).toBe("high");
    expect(parsePriority("")).toBe("normal");
    expect(parsePriority("urgentísimo")).toBe("invalid");
  });

  it("interpreta el seguro de decesos sin convertir vacíos en «no»", () => {
    expect(parseFuneralInsurance("Sí")).toBe(true);
    expect(parseFuneralInsurance("si")).toBe(true);
    expect(parseFuneralInsurance("NO")).toBe(false);
    expect(parseFuneralInsurance("")).toBeNull();
    expect(parseFuneralInsurance("Sin indicar")).toBeNull();
    expect(parseFuneralInsurance("quizá")).toBe("invalid");
  });

  const mapping = guessMapping(["nombre", "telefono", "email", "numero de poliza", "decesos", "producto", "cp"]);

  it("valida cada fila e informa de los errores", () => {
    const rows = validateRecords(
      [
        {
          nombre: "Ana Demo",
          telefono: "600111222",
          email: "ana@example.test",
          "numero de poliza": "POL-1",
          decesos: "Sí",
          producto: "Seguro de hogar",
          cp: "28001",
        },
        { nombre: "Sin datos", decesos: "", producto: "" },
        { nombre: "", telefono: "12", email: "mal" },
        { nombre: "Mal", decesos: "tal vez", producto: "Mascotas", cp: "!!" },
      ],
      mapping,
      TZ,
      PRODUCTS,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].value).toMatchObject({
      customer_reference: "POL-1",
      has_funeral_insurance: true,
      product_code: "hogar",
      postal_code: "28001",
    });
    expect(rows[1].value).toMatchObject({ has_funeral_insurance: null, product_code: null, postal_code: null });
    expect(rows[2].line).toBe(4);
    expect(rows[2].value).toBeNull();
    expect(rows[2].errors).toHaveLength(3);
    expect(rows[3].value).toBeNull();
    expect(rows[3].errors.join(" | ")).toMatch(/Seguro de decesos/);
    expect(rows[3].errors.join(" | ")).toMatch(/fuera del catálogo/);
    expect(rows[3].errors.join(" | ")).toMatch(/Código postal/);
  });

  it("no acepta productos retirados del catálogo", () => {
    const [row] = validateRecords([{ nombre: "X", producto: "Antiguo" }], mapping, TZ, PRODUCTS);
    expect(row.value).toBeNull();
  });

  it("detecta duplicados contra la base de datos y dentro del archivo", () => {
    const rows = validateRecords(
      [
        { nombre: "Uno", telefono: "+34 600 111 222" },
        { nombre: "Dos", telefono: "611 000 000", email: "dos@example.test" },
        { nombre: "Tres", email: "DOS@example.test" },
        { nombre: "Cuatro", "numero de poliza": "r-9" },
        { nombre: "Cinco", "numero de poliza": "R-9 " },
      ],
      mapping,
      TZ,
      PRODUCTS,
    );
    expect(collectKeys(rows)).toEqual({
      phones: ["600111222", "611000000"],
      emails: ["dos@example.test"],
      references: ["r-9"],
    });
    const marked = markDuplicates(rows, [
      { full_name: "Existente", phone_normalized: "600111222", email_normalized: null, customer_reference: null },
    ]);
    expect(marked[0].duplicate).toMatchObject({ source: "existing", field: "teléfono", matchName: "Existente" });
    expect(marked[1].duplicate).toBeNull();
    expect(marked[2].duplicate).toMatchObject({ source: "file", field: "email" });
    expect(marked[3].duplicate).toBeNull();
    // Duplicado por número de póliza (sin distinguir mayúsculas ni espacios).
    expect(marked[4].duplicate).toMatchObject({ source: "file", field: "número de póliza" });
    expect(summarize(marked)).toEqual({ total: 5, invalid: 0, duplicates: 3, clean: 2 });
  });

  it("divide en lotes", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
