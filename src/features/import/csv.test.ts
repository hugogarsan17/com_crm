import { describe, expect, it } from "vitest";
import { chunk, collectKeys, guessMapping, markDuplicates, parseImportDate, parsePriority, summarize, validateRecords } from "./csv";

const TZ = "Europe/Madrid";

describe("importación CSV", () => {
  it("propone el mapeo a partir de cabeceras habituales", () => {
    const m = guessMapping(["Nombre y apellidos", "Teléfono", "Correo", "Población", "Nº Cliente", "Producto", "Otra"]);
    expect(m).toMatchObject({
      full_name: "Nombre y apellidos",
      phone: "Teléfono",
      email: "Correo",
      locality: "Población",
      customer_reference: "Nº Cliente",
      product_to_offer: "Producto",
      notes: "",
    });
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

  const mapping = guessMapping(["nombre", "telefono", "email", "referencia", "polizas"]);

  it("valida cada fila e informa de los errores", () => {
    const rows = validateRecords(
      [
        { nombre: "Ana Demo", telefono: "600111222", email: "ana@example.test", referencia: "R1", polizas: "Auto; Hogar" },
        { nombre: "", telefono: "12", email: "mal" },
      ],
      mapping,
      TZ,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].value?.current_policies).toEqual(["Auto", "Hogar"]);
    expect(rows[1].line).toBe(3);
    expect(rows[1].value).toBeNull();
    expect(rows[1].errors).toHaveLength(3);
  });

  it("detecta duplicados contra la base de datos y dentro del archivo", () => {
    const rows = validateRecords(
      [
        { nombre: "Uno", telefono: "+34 600 111 222" },
        { nombre: "Dos", telefono: "611 000 000", email: "dos@example.test" },
        { nombre: "Tres", email: "DOS@example.test" },
        { nombre: "Cuatro", referencia: "r-9" },
      ],
      mapping,
      TZ,
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
    expect(summarize(marked)).toEqual({ total: 4, invalid: 0, duplicates: 2, clean: 2 });
  });

  it("divide en lotes", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
