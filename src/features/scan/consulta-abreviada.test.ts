import { describe, expect, it } from "vitest";
import { groupWordsIntoLines, hasFuneralCoverage, isConsultaAbreviada, parseConsultaAbreviada, type OcrWord } from "./consulta-abreviada";
import { scanReviewSchema } from "@/lib/validation/scan";
import { monospaceWords, SHEET_LINES } from "./__fixtures__/consulta-abreviada";
import { scanToReviewValues } from "./review-values";

function parse(lines = SHEET_LINES, confidence?: (word: string, line: number) => number) {
  return parseConsultaAbreviada(groupWordsIntoLines(monospaceWords(lines, confidence)));
}

function replaceLine(index: number, value: string) {
  return SHEET_LINES.map((l, i) => (i === index ? value : l));
}

describe("parseConsultaAbreviada", () => {
  it("extrae todos los campos de la hoja de ejemplo", () => {
    expect(parse()).toEqual({
      poliza: {
        producto: "25001",
        numero_poliza: "0012345678",
        fecha_efecto: "2019-03-01",
        tipo: "FAMILIAR",
        forma_pago: "MEN",
        situacion: "VI",
        fecha_baja: null,
        cubierto_hasta: "2026-12-31",
        prima_anual: 245.4,
        primer_recibo: 20.45,
        siguientes_recibos: 20.45,
        fecha_consulta: "2026-11-02T10:15:32",
      },
      tomador: {
        nombre: "Maria Isabel Garcia Lopez",
        dni: "12345678Z",
        telefono: "600 123 456",
        domicilio: "C/ MAYOR 12 3 B",
        municipio: "SANT CUGAT",
        codigo_postal: "08172",
        provincia: "BARCELONA",
      },
      garantias: [
        { nombre: "SER.DECESOS", estado: "SEG.POL." },
        { nombre: "ASISTENCIA", estado: "INCLUIDO" },
        { nombre: "TRASLADO", estado: "INCL. 2" },
      ],
      asegurados: [
        { orden: 1, nombre: "GARCIA LOPEZ MARIA IS", edad_real: 54, edad_derecho: 54, baja: null, motivo: null },
        { orden: 2, nombre: "PEREZ RUIZ JUAN ANTON", edad_real: 57, edad_derecho: 57, baja: null, motivo: null },
        { orden: 3, nombre: "PEREZ GARCIA LUCIA", edad_real: 12, edad_derecho: 12, baja: "2024-12-31", motivo: "02" },
      ],
      dudosos: [],
      lecturas: {},
    });
  });

  it("nunca devuelve el IBAN ni el domicilio de cobro", () => {
    const json = JSON.stringify(parse());
    expect(json).not.toMatch(/ES12|3456 7890|IBAN/);
    expect(json).not.toMatch(/PUERTO|BADALONA|8911/);
  });

  it("la fecha de baja vacía es null pero no dudosa", () => {
    const r = parse();
    expect(r.poliza.fecha_baja).toBeNull();
    expect(r.dudosos).not.toContain("poliza.fecha_baja");
  });

  it("marca como dudoso (null + lectura) un valor de baja confianza", () => {
    const r = parse(SHEET_LINES, (w) => (w === "MEN" ? 41 : 95));
    expect(r.poliza.forma_pago).toBeNull();
    expect(r.dudosos).toContain("poliza.forma_pago");
    expect(r.lecturas["poliza.forma_pago"]).toBe("MEN");
  });

  it("marca como dudoso un DNI cuya letra de control no cuadra", () => {
    const r = parse(replaceLine(3, "TOMADOR: GARCIA LOPEZ, MARIA ISABEL      DNI: 12345678A     TLF. 600123456"));
    expect(r.tomador.dni).toBeNull();
    expect(r.dudosos).toContain("tomador.dni");
  });

  it("completa el 0 inicial del CP solo si cuadra con la provincia", () => {
    expect(parse().tomador.codigo_postal).toBe("08172");
    const wrong = parse(replaceLine(6, "SANT CUGAT - 8172 - SEVILLA                BADALONA - 8911 - BARCELONA"));
    expect(wrong.tomador.codigo_postal).toBeNull();
    expect(wrong.dudosos).toContain("tomador.codigo_postal");
    expect(wrong.lecturas["tomador.codigo_postal"]).toBe("8172");
  });

  it("acepta nombres de provincia en castellano (alias)", () => {
    const r = parse(replaceLine(6, "BILBAO - 48001 - VIZCAYA                  BADALONA - 8911 - BARCELONA"));
    expect(r.tomador).toMatchObject({ municipio: "BILBAO", codigo_postal: "48001", provincia: "VIZCAYA" });
  });

  it("admite un número variable de asegurados", () => {
    const one = parse(SHEET_LINES.slice(0, 11));
    expect(one.asegurados.map((a) => a.orden)).toEqual([1]);
    const four = parse([...SHEET_LINES, "                           4     PEREZ GARCIA PABLO     9    9"]);
    expect(four.asegurados.map((a) => a.orden)).toEqual([1, 2, 3, 4]);
  });

  it("si falta una sección, sus campos quedan null y dudosos (sin inventar)", () => {
    const r = parse(SHEET_LINES.filter((_, i) => i !== 3));
    expect(r.tomador.nombre).toBeNull();
    expect(r.tomador.telefono).toBeNull();
    expect(r.dudosos).toEqual(expect.arrayContaining(["tomador.nombre", "tomador.dni", "tomador.telefono"]));
  });

  it("tolera una foto algo girada (la altura de las palabras varía a lo ancho de la fila)", () => {
    // -0,8°: a 800 px de ancho la fila sube ~11 px, más que la mitad de la altura de una palabra.
    const skewed = monospaceWords(SHEET_LINES).map((w) => ({ ...w, y0: w.y0 - w.x0 * 0.014, y1: w.y1 - w.x0 * 0.014 }));
    expect(parseConsultaAbreviada(groupWordsIntoLines(skewed))).toEqual(parse());
  });

  it("acepta números cortos con confianza media si su formato se valida, pero no texto libre", () => {
    const r = parse(SHEET_LINES, (w) => (w === "54" || w === "GARCIA" ? 60 : 95));
    expect(r.asegurados[0].edad_real).toBe(54);
    expect(r.tomador.nombre).toBeNull();
    expect(r.dudosos).toContain("tomador.nombre");
  });

  it("reagrupa palabras desordenadas en líneas por su posición", () => {
    const words = monospaceWords(SHEET_LINES);
    const shuffled = [...words].sort((a: OcrWord, b: OcrWord) => (a.text < b.text ? -1 : 1));
    expect(parseConsultaAbreviada(groupWordsIntoLines(shuffled))).toEqual(parse());
  });

  it("detecta el formato y el seguro de decesos", () => {
    expect(isConsultaAbreviada(groupWordsIntoLines(monospaceWords(SHEET_LINES)))).toBe(true);
    expect(isConsultaAbreviada(groupWordsIntoLines(monospaceWords(["Nombre: Ana", "Teléfono: 600111222"])))).toBe(false);
    expect(hasFuneralCoverage(parse().garantias)).toBe(true);
    expect(hasFuneralCoverage([{ nombre: "ASISTENCIA", estado: "INCLUIDO" }])).toBe(false);
  });
});

describe("scanToReviewValues", () => {
  it("convierte la hoja en una revisión válida sin DNI ni IBAN y con SER.DECESOS → decesos sí", () => {
    const { values, doubtful, dni } = scanToReviewValues(parse(), "2026-11-03T10:00");
    expect(values.lead).toMatchObject({
      full_name: "Maria Isabel Garcia Lopez",
      phone: "600 123 456",
      address: "C/ Mayor 12 3 B",
      postal_code: "08172",
      locality: "Sant Cugat",
      customer_reference: "0012345678",
      has_funeral_insurance: "yes",
    });
    expect(values.policy).toMatchObject({ annual_premium: "245,40", consulted_at: "2026-11-02T10:15", covered_until: "2026-12-31" });
    expect(dni).toBe("12345678Z");
    expect(doubtful).toEqual({});
    expect(JSON.stringify(values)).not.toMatch(/12345678Z|ES12/);

    const out = scanReviewSchema.parse(values);
    expect(out.policy.annual_premium).toBe(245.4);
    expect(out.insured[2]).toEqual({ orden: 3, nombre: "PEREZ GARCIA LUCIA", edad_real: 12, edad_derecho: 12, baja: "2024-12-31", motivo: "02" });
  });

  it("los dudosos llegan vacíos y señalados en su campo de la revisión", () => {
    const { values, doubtful } = scanToReviewValues(parse(SHEET_LINES, (w) => (w === "MEN" || w === "57" ? 30 : 95)), "2026-11-03T10:00");
    expect(values.policy.payment_frequency).toBe("");
    expect(doubtful["policy.payment_frequency"]).toBe("MEN");
    expect(doubtful["insured.1.edad_real"]).toBe("57");
  });

  it("la tarea opcional exige título y fecha si se activa", () => {
    const { values } = scanToReviewValues(parse(), "");
    const r = scanReviewSchema.safeParse({ ...values, task: { enabled: true, title: "", due_at: "" } });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["task.title", "task.due_at"]);
  });
});
