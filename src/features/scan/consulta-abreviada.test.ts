import { describe, expect, it } from "vitest";
import { scanReviewSchema } from "@/lib/validation/scan";
import { monospaceWords, SHEET_LINES } from "./__fixtures__/consulta-abreviada";
import { groupWordsIntoLines, hasFuneralCoverage, isConsultaAbreviada, parseConsultaAbreviada, type OcrWord } from "./consulta-abreviada";
import { scanToReviewValues } from "./review-values";

function parse(lines = SHEET_LINES, confidence?: (word: string, line: number) => number) {
  return parseConsultaAbreviada(groupWordsIntoLines(monospaceWords(lines, confidence)));
}

/** Sustituye un texto en una línea conservando las columnas (misma longitud o rellenando). */
function edit(index: number, from: string, to: string) {
  return SHEET_LINES.map((l, i) => {
    if (i !== index) return l;
    if (!l.includes(from)) throw new Error(`«${from}» no está en la línea ${index}`);
    return l.replace(from, to.padEnd(from.length, " "));
  });
}

const LINE = { header: 2, values: 3, dates: 4, holder: 5, address: 7, city: 8, table: 9, row1: 10, row2: 11, row3: 12, row4: 13, totals: 16 };

describe("parseConsultaAbreviada (disposición real, datos inventados)", () => {
  it("extrae todos los campos de la hoja de ejemplo", () => {
    expect(parse()).toEqual({
      poliza: {
        producto: "25001",
        numero_poliza: "0012345678",
        fecha_efecto: "2019-03-01",
        tipo: "TS",
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
        domicilio: "CL MAYOR, 0012 3-B",
        municipio: "S CUGAT DEL VALLES",
        codigo_postal: "08172",
        provincia: "BARCELONA",
      },
      garantias: [
        { nombre: "SER.DECESOS", estado: "SEG.POL." },
        { nombre: "PR.INTEGRAL", estado: "INCL. 5" },
        { nombre: "ASIS. VIAJE", estado: "INCLUIDO" },
        { nombre: "AS.EXTRANJ.", estado: "INCLUIDO" },
        { nombre: "AC.MUERTE", estado: "SEG.POL." },
      ],
      asegurados: [
        { orden: 1, nombre: "MARIA ISABEL GARCIA LO", edad_real: 54, edad_derecho: 40, baja: null, motivo: null },
        { orden: 2, nombre: "JUAN ANTONIO PEREZ RUI", edad_real: 57, edad_derecho: 45, baja: null, motivo: null },
        { orden: 3, nombre: "LUCIA PEREZ GARCIA", edad_real: 12, edad_derecho: 2, baja: "2024-12-31", motivo: "02" },
      ],
      dudosos: [],
      lecturas: {},
    });
  });

  it("nunca devuelve el IBAN ni el domicilio de cobro", () => {
    const json = JSON.stringify(parse());
    expect(json).not.toMatch(/ES12|3456-7890|IBAN/);
    expect(json).not.toMatch(/PUERTO|BADALONA/);
  });

  it("la fecha de baja vacía (bajo «--F.BAJA--») es null pero no dudosa", () => {
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

  it("exige confianza alta al número de póliza (un dígito cambiado no lo detecta ningún formato)", () => {
    const r = parse(SHEET_LINES, (w) => (w === "0012345678" ? 85 : 95));
    expect(r.poliza.numero_poliza).toBeNull();
    expect(r.lecturas["poliza.numero_poliza"]).toBe("0012345678");
  });

  it("acepta números cortos con confianza media si su formato se valida, pero no texto libre", () => {
    const r = parse(SHEET_LINES, (w) => (w === "54" || w === "LOPEZ" ? 60 : 95));
    expect(r.asegurados[0].edad_real).toBe(54);
    expect(r.tomador.nombre).toBeNull();
    expect(r.dudosos).toContain("tomador.nombre");
  });

  it("marca como dudoso un DNI cuya letra de control no cuadra", () => {
    const r = parse(edit(LINE.holder, "12345678Z", "123456782"));
    expect(r.tomador.dni).toBeNull();
    expect(r.lecturas["tomador.dni"]).toBe("123456782");
    // El teléfono, en el mismo tramo de texto, se sigue leyendo.
    expect(r.tomador.telefono).toBe("600 123 456");
  });

  it("tolera la confusión M/N del OCR en las etiquetas", () => {
    let lines = edit(LINE.header, "NUM.", "NUN.");
    lines = lines.map((l, i) => (i === LINE.holder ? l.replace("TOMADOR:", "TONADOR:") : i === LINE.dates ? l.replace("FECHA EFECTO:", "FECNA SFECTO:") : l));
    const r = parse(lines);
    expect(r.poliza.numero_poliza).toBe("0012345678");
    expect(r.poliza.fecha_efecto).toBe("2019-03-01");
    expect(r.tomador.nombre).toBe("Maria Isabel Garcia Lopez");
  });

  it("si «|ANUAL:» no se lee, la prima anual es el importe justo antes de «1.REC:»", () => {
    const r = parse(edit(LINE.totals, "|ANUAL:", "|En"));
    expect(r.poliza.prima_anual).toBe(245.4);
  });

  it("separa la columna de cobro aunque su cabecera no se lea (usa la posición del IBAN)", () => {
    const r = parse(edit(6, "--------- DOMICILIO DE COBRO --------", "eeemoomeo ARE CIL QUIE CONO === aa"));
    expect(r.tomador).toMatchObject({ domicilio: "CL MAYOR, 0012 3-B", municipio: "S CUGAT DEL VALLES", codigo_postal: "08172" });
    expect(JSON.stringify(r)).not.toMatch(/PUERTO|BADALONA|ES12/);
  });

  it("garantías: el vocabulario conocido se acepta aunque la confianza sea baja; lo desconocido no", () => {
    const r = parse(edit(LINE.row4, "AC.MUERTE", "AC.NUERTE"), (w) => (w === "SER.DECESOS" || w === "AC.NUERTE" ? 20 : 95));
    expect(r.garantias[0].nombre).toBe("SER.DECESOS");
    // «AC.NUERTE» (M leída como N) coincide con AC.MUERTE aunque la confianza sea baja.
    expect(r.garantias[4].nombre).toBe("AC.MUERTE");
    const unknown = parse(edit(LINE.row4, "AC.MUERTE", "OTRA COSA"), (w) => (w === "OTRA" ? 20 : 95));
    expect(unknown.garantias[4].nombre).toBeNull();
    expect(unknown.dudosos).toContain("garantias.4.nombre");
  });

  it("estados: se limpian restos del borde pegados, pero las letras mal leídas quedan dudosas", () => {
    expect(parse(edit(LINE.row2, "INCLUIDO", "1INCLUIDO")).garantias[2].estado).toBe("INCLUIDO");
    const r = parse(edit(LINE.row4, "SEG.POL.", "EG. POL,"));
    expect(r.garantias[4]).toEqual({ nombre: "AC.MUERTE", estado: null });
    expect(r.lecturas["garantias.4.estado"]).toBe("EG. POL,");
  });

  it("completa el 0 inicial del CP solo si cuadra con la provincia", () => {
    expect(parse().tomador.codigo_postal).toBe("08172");
    const wrong = parse(edit(LINE.city, "S CUGAT DEL VALLES - 8172 - BARCELONA", "S CUGAT DEL VALLES - 8172 - SEVILLA"));
    expect(wrong.tomador.codigo_postal).toBeNull();
    expect(wrong.lecturas["tomador.codigo_postal"]).toBe("8172");
  });

  it("acepta nombres de provincia en castellano (alias)", () => {
    const r = parse(edit(LINE.city, "S CUGAT DEL VALLES - 8172 - BARCELONA", "BILBAO - 48001 - VIZCAYA"));
    expect(r.tomador).toMatchObject({ municipio: "BILBAO", codigo_postal: "48001", provincia: "VIZCAYA" });
  });

  it("admite un número variable de asegurados", () => {
    const one = parse(edit(LINE.row3, "| _  3 LUCIA PEREZ GARCIA     12    2   31-12-24 02", "|").map((l, i) => (i === LINE.row2 ? l.replace("| _  2 JUAN ANTONIO PEREZ RUI 57   45", "|") : l)));
    expect(one.asegurados.map((a) => a.orden)).toEqual([1]);
    const four = parse(edit(LINE.row4, "|", "| _  4 PABLO PEREZ GARCIA      9    0"));
    expect(four.asegurados.map((a) => a.orden)).toEqual([1, 2, 3, 4]);
    expect(four.asegurados[3]).toMatchObject({ nombre: "PABLO PEREZ GARCIA", edad_real: 9, edad_derecho: 0 });
  });

  it("si falta una sección, sus campos quedan null y dudosos (sin inventar)", () => {
    const r = parse(SHEET_LINES.filter((_, i) => i !== LINE.holder));
    expect(r.tomador.nombre).toBeNull();
    expect(r.tomador.telefono).toBeNull();
    expect(r.dudosos).toEqual(expect.arrayContaining(["tomador.nombre", "tomador.dni", "tomador.telefono"]));
  });

  it("tolera una foto con perspectiva (la columna derecha queda más baja)", () => {
    // Hasta ~1,5 líneas de desnivel de lado a lado, como en las fotos reales.
    const skewed = monospaceWords(SHEET_LINES).map((w) => ({ ...w, y0: w.y0 + w.x0 * 0.04, y1: w.y1 + w.x0 * 0.04 }));
    expect(parseConsultaAbreviada(groupWordsIntoLines(skewed))).toEqual(parse());
  });

  it("reagrupa palabras desordenadas en líneas por su posición", () => {
    const shuffled = [...monospaceWords(SHEET_LINES)].sort((a: OcrWord, b: OcrWord) => (a.text < b.text ? -1 : 1));
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
      address: "Cl Mayor, 0012 3-B",
      postal_code: "08172",
      locality: "S Cugat del Valles",
      customer_reference: "0012345678",
      has_funeral_insurance: "yes",
    });
    expect(values.policy).toMatchObject({ annual_premium: "245,40", consulted_at: "2026-11-02T10:15", covered_until: "2026-12-31" });
    expect(dni).toBe("12345678Z");
    expect(doubtful).toEqual({});
    expect(JSON.stringify(values)).not.toMatch(/12345678Z|ES12/);

    const out = scanReviewSchema.parse(values);
    expect(out.policy.annual_premium).toBe(245.4);
    expect(out.insured[2]).toEqual({ orden: 3, nombre: "LUCIA PEREZ GARCIA", edad_real: 12, edad_derecho: 2, baja: "2024-12-31", motivo: "02" });
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
