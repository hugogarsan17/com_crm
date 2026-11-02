import { z } from "zod";
import { SPANISH_PROVINCES, isSpanishPostalCode } from "@/features/postal-codes/spain";
import { isValidLocalDate } from "@/lib/dates";
import { parseMoney } from "@/lib/validation/common";

/**
 * Lector de la hoja impresa «CONSULTA ABREVIADA» (ramos tradicionales).
 *
 * Trabaja con las palabras que devuelve el OCR (texto, posición y confianza), porque en
 * la hoja muchos valores van DEBAJO de su cabecera (PRODU, NUM. POLIZA, FP, SIT) y hay
 * columnas paralelas (garantías | asegurados, domicilio del tomador | de cobro).
 *
 * Reglas: si un valor no se lee con seguridad (confianza baja o formato incorrecto) se
 * devuelve null y su ruta va a `dudosos`; el texto leído se guarda en `lecturas` como
 * pista para la revisión. Nunca se completa ni se inventa nada. El IBAN se descarta
 * antes de procesar y el domicilio de cobro no se extrae.
 */

export type OcrWord = { text: string; x0: number; x1: number; y0: number; y1: number; confidence: number };
export type OcrLine = OcrWord[];

/**
 * Confianza mínima (0–100) de Tesseract para aceptar un valor. Los tokens cortos
 * (números, códigos) reciben confianzas bajas aunque se lean bien, así que los valores
 * con un formato estricto que además se valida (fecha, importe con coma, código, edad,
 * DNI con letra de control…) se aceptan con menos; el texto libre exige más.
 */
export const MIN_CONFIDENCE = 70;
export const MIN_CONFIDENCE_STRICT = 50;

// -----------------------------------------------------------------------------
// Esquema del resultado (JSON validado)
// -----------------------------------------------------------------------------
const isoDate = z.string().refine(isValidLocalDate, "Fecha no válida");
const nullableText = z.string().min(1).nullable();

export const garantiaSchema = z.object({ nombre: z.string().min(1).nullable(), estado: z.string().min(1).nullable() });

export const aseguradoSchema = z.object({
  orden: z.number().int().positive().nullable(),
  nombre: z.string().min(1).nullable(),
  edad_real: z.number().int().min(0).max(130).nullable(),
  edad_derecho: z.number().int().min(0).max(130).nullable(),
  baja: isoDate.nullable(),
  motivo: z.string().min(1).nullable(),
});

export const consultaAbreviadaSchema = z.object({
  poliza: z.object({
    producto: z.string().regex(/^\d{3,6}$/).nullable(),
    numero_poliza: z.string().regex(/^[A-Z0-9-]{4,20}$/).nullable(),
    fecha_efecto: isoDate.nullable(),
    tipo: nullableText,
    forma_pago: z.string().regex(/^[A-Z]{3}$/).nullable(),
    situacion: z.string().regex(/^[A-Z]{1,3}$/).nullable(),
    fecha_baja: isoDate.nullable(),
    cubierto_hasta: isoDate.nullable(),
    prima_anual: z.number().nonnegative().nullable(),
    primer_recibo: z.number().nonnegative().nullable(),
    siguientes_recibos: z.number().nonnegative().nullable(),
    /** Hora local de la cabecera, "YYYY-MM-DDTHH:mm:ss". */
    fecha_consulta: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).nullable(),
  }),
  tomador: z.object({
    nombre: nullableText,
    /** Solo para comprobarlo en la revisión: no se guarda. */
    dni: z.string().regex(/^[0-9XYZ]\d{7}[A-Z]$/).nullable(),
    telefono: z.string().regex(/^\d{3} \d{3} \d{3}$/).nullable(),
    domicilio: nullableText,
    municipio: nullableText,
    codigo_postal: z.string().regex(/^\d{5}$/).nullable(),
    provincia: nullableText,
  }),
  garantias: z.array(garantiaSchema),
  asegurados: z.array(aseguradoSchema),
  /** Rutas de los campos no leídos con seguridad (p. ej. "poliza.forma_pago", "asegurados.2.edad_real"). */
  dudosos: z.array(z.string()),
  /** Texto leído en los campos dudosos (pista para la revisión; nunca se guarda solo). */
  lecturas: z.record(z.string(), z.string()),
});

export type ConsultaAbreviada = z.infer<typeof consultaAbreviadaSchema>;

export const FORMAS_PAGO: Record<string, string> = {
  MEN: "Mensual",
  BIM: "Bimestral",
  TRI: "Trimestral",
  CUA: "Cuatrimestral",
  SEM: "Semestral",
  ANU: "Anual",
  UNI: "Única",
};

// -----------------------------------------------------------------------------
// Utilidades de texto y posición
// -----------------------------------------------------------------------------
function fold(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]{4}){3,7}(?:[\s-]?[A-Z0-9]{1,4})?\b/;

/**
 * Agrupa las palabras en líneas por su posición (independiente de cómo haya
 * segmentado Tesseract los bloques). Se recorren de izquierda a derecha y cada palabra
 * se une a la línea cuya última palabra está a su altura: así se tolera que la foto
 * esté algo girada (la altura cambia poco entre palabras vecinas, aunque sí a lo ancho).
 */
export function groupWordsIntoLines(words: OcrWord[]): OcrLine[] {
  const cy = (w: OcrWord) => (w.y0 + w.y1) / 2;
  const sorted = words.filter((w) => w.text.trim()).sort((a, b) => a.x0 - b.x0);
  const lines: OcrLine[] = [];
  for (const word of sorted) {
    let best: OcrLine | null = null;
    let bestDist = Infinity;
    for (const line of lines) {
      const last = line[line.length - 1];
      const dist = Math.abs(cy(last) - cy(word));
      const tolerance = Math.max(last.y1 - last.y0, word.y1 - word.y0) * 0.6;
      if (dist < tolerance && dist < bestDist && last.x1 <= word.x0 + 2) {
        best = line;
        bestDist = dist;
      }
    }
    if (best) best.push(word);
    else lines.push([word]);
  }
  return lines.sort((a, b) => cy(a[0]) - cy(b[0]));
}

/** Elimina el IBAN (la línea etiquetada y cualquier secuencia con su formato) antes de procesar. */
export function stripIban(lines: OcrLine[]): OcrLine[] {
  return lines
    .filter((line) => !/^\W*IBAN\b/.test(fold(line.map((w) => w.text).join(" "))))
    .map((line) => {
      const text = line.map((w) => w.text).join(" ");
      const match = IBAN_RE.exec(fold(text));
      if (!match) return line;
      // Quita las palabras que forman parte de la secuencia del IBAN.
      let pos = 0;
      return line.filter((w) => {
        const start = pos;
        pos += w.text.length + 1;
        return start + w.text.length <= match.index || start >= match.index + match[0].length;
      });
    })
    .filter((line) => line.length > 0);
}

/** Ancho medio de carácter (la hoja es de letra de ancho fijo). */
function charWidth(lines: OcrLine[]) {
  const widths = lines.flat().filter((w) => w.text.length >= 3).map((w) => (w.x1 - w.x0) / w.text.length).sort((a, b) => a - b);
  return widths.length ? widths[Math.floor(widths.length / 2)] : 10;
}

type Segment = { words: OcrWord[]; text: string; x0: number; x1: number };

/** Divide una línea en segmentos separados por huecos de dos o más caracteres (columnas). */
function segments(line: OcrLine, cw: number): Segment[] {
  const out: Segment[] = [];
  for (const w of line) {
    const last = out[out.length - 1];
    if (last && w.x0 - last.x1 < cw * 1.6) {
      last.words.push(w);
      last.x1 = w.x1;
      last.text += ` ${w.text}`;
    } else {
      out.push({ words: [w], text: w.text, x0: w.x0, x1: w.x1 });
    }
  }
  return out;
}

type Reading = { text: string; confidence: number } | null;

function reading(words: OcrWord[]): Reading {
  if (words.length === 0) return null;
  return { text: words.map((w) => w.text).join(" "), confidence: Math.min(...words.map((w) => w.confidence)) };
}

/** Palabras de `words` que quedan después del prefijo de `text` que coincide con `label`. */
function wordsAfter(words: OcrWord[], labelEndChar: number) {
  let pos = 0;
  const out: OcrWord[] = [];
  for (const w of words) {
    const start = pos;
    pos += w.text.length + 1;
    if (start >= labelEndChar) out.push(w);
    else if (start + w.text.length > labelEndChar) {
      // La etiqueta y el valor vienen pegados en la misma palabra («ANUAL:245,40»).
      out.push({ ...w, text: w.text.slice(labelEndChar - start) });
    }
  }
  return out.filter((w) => w.text);
}

// Un segmento que empieza por otra etiqueta no es el valor de la anterior.
const LOOKS_LIKE_LABEL = /^[A-Z0-9./ ]{1,25}:/;

// -----------------------------------------------------------------------------
// Lector
// -----------------------------------------------------------------------------
class Sheet {
  readonly cw: number;
  readonly segs: Segment[][];
  readonly dudosos = new Set<string>();
  readonly lecturas: Record<string, string> = {};

  constructor(readonly lines: OcrLine[]) {
    this.cw = charWidth(lines);
    this.segs = lines.map((l) => segments(l, this.cw));
  }

  /** Valor tras una etiqueta en la misma línea. `found: false` si la etiqueta no aparece. */
  after(label: RegExp, maxX?: number): { found: boolean; value: Reading } {
    for (const lineSegs of this.segs) {
      for (let i = 0; i < lineSegs.length; i++) {
        const seg = lineSegs[i];
        if (maxX !== undefined && seg.x0 >= maxX) continue;
        const m = new RegExp(`^(?:.*?\\s)?(${label.source})\\s*`, "i").exec(fold(seg.text));
        if (!m) continue;
        const own = wordsAfter(seg.words, m[0].length);
        if (own.length) return { found: true, value: reading(own) };
        const next = lineSegs[i + 1];
        if (next && !LOOKS_LIKE_LABEL.test(fold(next.text)) && (maxX === undefined || next.x0 < maxX)) {
          return { found: true, value: reading(next.words) };
        }
        return { found: true, value: null };
      }
    }
    return { found: false, value: null };
  }

  /** Valor situado debajo de una cabecera (alineado por la izquierda con ella). */
  under(header: RegExp): { found: boolean; value: Reading } {
    for (let li = 0; li < this.segs.length - 1; li++) {
      for (const seg of this.segs[li]) {
        // La cabecera puede compartir segmento con otras («PRODU NUM. POLIZA» con un solo espacio).
        const words = seg.words;
        for (let wi = 0; wi < words.length; wi++) {
          const rest = fold(words.slice(wi).map((w) => w.text).join(" "));
          const m = new RegExp(`^(${header.source})(?![A-Z])`, "i").exec(rest);
          if (!m) continue;
          const nWords = m[1].trim().split(/\s+/).length;
          const hx0 = words[wi].x0;
          const hx1 = words[wi + nWords - 1].x1;
          const below = this.segs[li + 1].flatMap((s) => s.words).filter((w) => w.x0 >= hx0 - this.cw * 1.5 && w.x0 <= hx1);
          return { found: true, value: reading(below) };
        }
      }
    }
    return { found: false, value: null };
  }

  /**
   * Acepta el valor si la confianza es suficiente y `parse` lo da por válido. Si no,
   * devuelve null y lo marca como dudoso (salvo `emptyIsValid` y valor ausente).
   */
  accept<T>(
    path: string,
    r: { found: boolean; value: Reading },
    parse: (text: string) => T | null,
    { emptyIsValid = false, strict = false }: { emptyIsValid?: boolean; strict?: boolean } = {},
  ): T | null {
    if (!r.value) {
      if (!(emptyIsValid && r.found)) this.dudosos.add(path);
      return null;
    }
    const parsed = parse(r.value.text.trim());
    if (parsed === null || r.value.confidence < (strict ? MIN_CONFIDENCE_STRICT : MIN_CONFIDENCE)) {
      this.dudosos.add(path);
      this.lecturas[path] = r.value.text.trim();
      return null;
    }
    return parsed;
  }
}

// -----------------------------------------------------------------------------
// Validadores de formato
// -----------------------------------------------------------------------------
function parseDate(text: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text.replace(/\s/g, ""));
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidLocalDate(iso) ? iso : null;
}

function parseAmount(text: string): number | null {
  // Importes con coma decimal («245,40»); se exige la coma para no confundir otros números.
  if (!/^\d{1,3}(?:\.?\d{3})*,\d{2}$/.test(text.replace(/\s|€/g, ""))) return null;
  return parseMoney(text);
}

function parseInt0(text: string): number | null {
  return /^\d{1,3}$/.test(text) ? Number(text) : null;
}

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** DNI/NIE con letra de control correcta (si no cuadra, se considera mal leído). */
function parseDni(text: string): string | null {
  const v = fold(text).replace(/[\s.-]/g, "");
  const m = /^([0-9XYZ])(\d{7})([A-Z])$/.exec(v);
  if (!m) return null;
  const number = Number(`${"XYZ".indexOf(m[1]) >= 0 ? "XYZ".indexOf(m[1]) : m[1]}${m[2]}`);
  return DNI_LETTERS[number % 23] === m[3] ? v : null;
}

function parsePhone(text: string): string | null {
  const digits = text.replace(/\D/g, "").replace(/^(0034|34)(?=\d{9}$)/, "");
  return /^[6789]\d{8}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : null;
}

function parseText(max: number) {
  return (text: string) => {
    const v = text.replace(/\s+/g, " ").trim();
    return v && v.length <= max && /\p{L}/u.test(v) ? v : null;
  };
}

// Nombres de provincia que pueden aparecer en la hoja (castellano, sin tildes) por código INE.
const PROVINCE_ALIASES: Record<string, string[]> = {
  "01": ["ALAVA", "ARABA"], "03": ["ALICANTE", "ALACANT"], "07": ["BALEARES", "ILLES BALEARS", "BALEARS"],
  "12": ["CASTELLON", "CASTELLO"], "15": ["LA CORUNA", "CORUNA", "A CORUNA"], "17": ["GERONA", "GIRONA"],
  "20": ["GUIPUZCOA", "GIPUZKOA"], "25": ["LERIDA", "LLEIDA"], "32": ["ORENSE", "OURENSE"],
  "38": ["SANTA CRUZ DE TENERIFE", "S.C. TENERIFE", "TENERIFE"], "46": ["VALENCIA"], "48": ["VIZCAYA", "BIZKAIA"],
};

/** ¿La provincia impresa corresponde al código postal? */
function provinceMatches(postalCode: string, printed: string) {
  const code = postalCode.slice(0, 2);
  const names = [...(SPANISH_PROVINCES[code] ?? "").split("/"), ...(PROVINCE_ALIASES[code] ?? [])].map(fold);
  const p = fold(printed).replace(/\s+/g, " ").trim();
  return names.some((n) => n && (p === n || p.includes(n) || n.includes(p)));
}

/** «GARCIA LOPEZ, MARIA ISABEL» → «Maria Isabel Garcia Lopez» (sin añadir tildes que no se leen). */
function formatHolderName(text: string): string | null {
  const v = text.replace(/\s+/g, " ").trim();
  if (!/^[\p{L}][\p{L} ,.'-]{2,150}$/u.test(v)) return null;
  const parts = v.split(",").map((p) => p.trim()).filter(Boolean);
  const ordered = parts.length === 2 ? `${parts[1]} ${parts[0]}` : v.replace(/,/g, " ");
  const particles = new Set(["de", "del", "la", "las", "los", "y", "e"]);
  return ordered
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && particles.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// -----------------------------------------------------------------------------
// Secciones
// -----------------------------------------------------------------------------
const GARANTIA_ESTADO = /(SEG\.?\s?POL\.?|INCLUIDO|INCL\.?\s*\d+)/;

function readTomadorAddress(sheet: Sheet) {
  const headerLine = sheet.segs.findIndex((segs) => segs.some((s) => /DOMICILIO\s+DEL\s+TOMADOR/.test(fold(s.text))));
  const result = { domicilio: null as string | null, municipio: null as string | null, codigo_postal: null as string | null, provincia: null as string | null };
  if (headerLine < 0) {
    for (const k of ["domicilio", "municipio", "codigo_postal", "provincia"]) sheet.dudosos.add(`tomador.${k}`);
    return result;
  }
  // El domicilio de cobro puede ir en la misma fila (columna derecha): se ignora todo lo que quede a su altura.
  const cobro = sheet.segs[headerLine].find((s) => /DOMICILIO\s+DE\s+COBRO/.test(fold(s.text)));
  const maxX = cobro ? cobro.x0 - sheet.cw : Infinity;
  const block = sheet.lines.slice(headerLine + 1, headerLine + 4).map((l) => l.filter((w) => w.x1 <= maxX + sheet.cw));

  const cityIdx = block.findIndex((l) => /^.+\s[-–—]\s*\d{4,5}\s*[-–—]\s.+$/.test(l.map((w) => w.text).join(" ")));
  const addressWords = (cityIdx > 0 ? block.slice(0, cityIdx) : block.slice(0, 1)).flat();
  result.domicilio = sheet.accept("tomador.domicilio", { found: true, value: reading(addressWords) }, parseText(200));

  if (cityIdx < 0) {
    for (const k of ["municipio", "codigo_postal", "provincia"]) sheet.dudosos.add(`tomador.${k}`);
    return result;
  }
  const cityWords = block[cityIdx];
  // Cada parte con su propia confianza; si los guiones vienen pegados a las palabras, se parte el texto.
  const parts: OcrWord[][] = [[]];
  for (const w of cityWords) {
    if (/^[-–—]$/.test(w.text)) parts.push([]);
    else parts[parts.length - 1].push(w);
  }
  let [munR, cpR, provR]: Reading[] = parts.length === 3 ? parts.map(reading) : [null, null, null];
  if (parts.length !== 3) {
    const conf = Math.min(...cityWords.map((w) => w.confidence));
    const texts = cityWords.map((w) => w.text).join(" ").split(/\s[-–—]\s*|\s*[-–—]\s/).map((t) => t.trim());
    [munR, cpR, provR] = texts.map((t) => (t ? { text: t, confidence: conf } : null));
  }
  const provincia = provR?.text;

  result.municipio = sheet.accept("tomador.municipio", { found: true, value: munR }, parseText(120));
  result.provincia = sheet.accept("tomador.provincia", { found: true, value: provR }, parseText(60));
  // CP: se completa el 0 inicial solo si así cuadra con la provincia impresa.
  result.codigo_postal = sheet.accept("tomador.codigo_postal", { found: true, value: cpR }, (t) => {
    if (!/^\d{4,5}$/.test(t)) return null;
    const padded = t.padStart(5, "0");
    return isSpanishPostalCode(padded) && provincia && provinceMatches(padded, provincia) ? padded : null;
  }, { strict: true });
  return result;
}

function readTable(sheet: Sheet) {
  const garantias: ConsultaAbreviada["garantias"] = [];
  const asegurados: ConsultaAbreviada["asegurados"] = [];

  const headerLine = sheet.lines.findIndex((l) => /X\/G\/P\s+NOMBRE/.test(fold(l.map((w) => w.text).join(" "))));
  const header = headerLine >= 0 ? sheet.lines[headerLine] : null;
  const col = (re: RegExp) => header?.find((w) => re.test(fold(w.text)));
  const cols = header
    ? (
        [
          ["orden", col(/^X\/G\/P$/)],
          ["nombre", col(/^NOMBRE$/)],
          ["edad_real", col(/^REAL$/)],
          ["edad_derecho", col(/^DER\.?$/)],
          ["baja", col(/^BAJA$/)],
          ["motivo", col(/^MOT\.?$/)],
        ] as const
      ).filter((c): c is readonly [typeof c[0], OcrWord] => Boolean(c[1]))
    : [];
  const tableX0 = cols.length ? cols[0][1].x0 - sheet.cw : Infinity;

  // Garantías: columna izquierda (a la izquierda de la tabla de asegurados, si existe).
  // Nombre y estado se valoran por separado con la confianza de sus propias palabras.
  const estadoRe = new RegExp(`^${GARANTIA_ESTADO.source}$`);
  sheet.lines.forEach((line) => {
    const left = line.filter((w) => w.x1 <= tableX0);
    let nameWords: OcrWord[] = [];
    for (let i = 0; i < left.length; i++) {
      // El estado puede ocupar una o dos palabras («INCL. 2», «SEG. POL.»).
      const two = i + 1 < left.length ? fold(`${left[i].text} ${left[i + 1].text}`) : "";
      const one = fold(left[i].text);
      const span = estadoRe.test(two) ? 2 : estadoRe.test(one) ? 1 : 0;
      if (span === 0 || nameWords.length === 0) {
        if (span === 0) nameWords.push(left[i]);
        continue;
      }
      const nombreText = nameWords.map((w) => w.text).join(" ");
      if (!/[:]/.test(nombreText) && !/TOMADOR|DOMICILIO|PRIMAS|ANUAL/.test(fold(nombreText))) {
        const idx = garantias.length;
        garantias.push({
          nombre: sheet.accept(`garantias.${idx}.nombre`, { found: true, value: reading(nameWords) }, (t) => (/\p{L}{3}/u.test(t) && t.length <= 80 ? fold(t) : null)),
          estado: sheet.accept(`garantias.${idx}.estado`, { found: true, value: reading(left.slice(i, i + span)) }, (t) => fold(t).replace(/\s+/g, " ").replace(/^SEG\.? ?POL\.?$/, "SEG.POL."), { strict: true }),
        });
      }
      nameWords = [];
      i += span - 1;
    }
  });

  if (!header || cols.length === 0) {
    sheet.dudosos.add("asegurados");
    return { garantias, asegurados };
  }

  // Asegurados: filas bajo la cabecera cuya primera columna es un número de orden.
  const bounds = cols.map(([key, w], i) => ({ key, from: w.x0 - sheet.cw * 1.5, to: i + 1 < cols.length ? cols[i + 1][1].x0 - sheet.cw * 1.5 : Infinity }));
  for (let li = headerLine + 1; li < sheet.lines.length; li++) {
    const right = sheet.lines[li].filter((w) => w.x0 >= bounds[0].from);
    if (right.length === 0) continue;
    const cells = Object.fromEntries(bounds.map((b) => [b.key, right.filter((w) => w.x0 >= b.from && w.x0 < b.to)])) as Record<string, OcrWord[]>;
    if (!/^\d{1,2}$/.test(cells.orden?.[0]?.text ?? "")) {
      if (asegurados.length > 0) break; // fin de la tabla
      continue;
    }
    const i = asegurados.length;
    const cell = (key: string): { found: boolean; value: Reading } => ({ found: true, value: reading(cells[key] ?? []) });
    asegurados.push({
      orden: sheet.accept(`asegurados.${i}.orden`, cell("orden"), parseInt0, { strict: true }),
      // El nombre viene truncado por la pantalla: se guarda tal cual.
      nombre: sheet.accept(`asegurados.${i}.nombre`, cell("nombre"), parseText(80)),
      edad_real: sheet.accept(`asegurados.${i}.edad_real`, cell("edad_real"), parseInt0, { strict: true }),
      edad_derecho: sheet.accept(`asegurados.${i}.edad_derecho`, cell("edad_derecho"), parseInt0, { strict: true }),
      baja: sheet.accept(`asegurados.${i}.baja`, cell("baja"), parseDate, { emptyIsValid: true, strict: true }),
      motivo: sheet.accept(`asegurados.${i}.motivo`, cell("motivo"), (t) => (/^[A-Z0-9]{1,4}$/.test(fold(t)) ? fold(t) : null), { emptyIsValid: true, strict: true }),
    });
  }
  return { garantias, asegurados };
}

/** ¿El texto reconocido es una hoja «Consulta abreviada»? */
export function isConsultaAbreviada(lines: OcrLine[]) {
  const text = fold(lines.map((l) => l.map((w) => w.text).join(" ")).join("\n"));
  return /CONSULTA\s+ABREVIADA/.test(text) || (/TOMADOR/.test(text) && /NUM\.?\s*POLIZA/.test(text));
}

/** Extrae y valida todos los datos de la hoja. */
export function parseConsultaAbreviada(rawLines: OcrLine[]): ConsultaAbreviada {
  const lines = stripIban(rawLines);
  const sheet = new Sheet(lines);

  // Cabecera: «dd/mm/aa hh:mm:ss».
  let fecha_consulta: string | null = null;
  for (const line of lines.slice(0, 4)) {
    const m = /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(line.map((w) => w.text).join(" "));
    if (!m) continue;
    const iso = `20${m[3]}-${m[2]}-${m[1]}`;
    const conf = Math.min(...line.filter((w) => /\d/.test(w.text)).map((w) => w.confidence));
    if (isValidLocalDate(iso) && Number(m[4]) < 24 && Number(m[5]) < 60 && conf >= MIN_CONFIDENCE) {
      fecha_consulta = `${iso}T${m[4]}:${m[5]}:${m[6]}`;
    } else {
      sheet.dudosos.add("poliza.fecha_consulta");
      sheet.lecturas["poliza.fecha_consulta"] = m[0];
    }
    break;
  }
  if (fecha_consulta === null && !sheet.dudosos.has("poliza.fecha_consulta")) sheet.dudosos.add("poliza.fecha_consulta");

  const domicilio = readTomadorAddress(sheet);
  const { garantias, asegurados } = readTable(sheet);

  const result: ConsultaAbreviada = {
    poliza: {
      producto: sheet.accept("poliza.producto", sheet.under(/PRODU\.?/), (t) => (/^\d{3,6}$/.test(t) ? t : null), { strict: true }),
      numero_poliza: sheet.accept("poliza.numero_poliza", sheet.under(/NUM\.?\s*POLIZA/), (t) => {
        const v = fold(t).replace(/\s/g, "");
        return /^[A-Z0-9-]{4,20}$/.test(v) && /\d{4}/.test(v) ? v : null;
      }, { strict: true }),
      fecha_efecto: sheet.accept("poliza.fecha_efecto", sheet.after(/FECHA\s+EFECTO:?/), parseDate, { strict: true }),
      tipo: sheet.accept("poliza.tipo", sheet.after(/TIPO:/), parseText(60)),
      forma_pago: sheet.accept("poliza.forma_pago", sheet.under(/FP/), (t) => (fold(t) in FORMAS_PAGO ? fold(t) : null), { strict: true }),
      situacion: sheet.accept("poliza.situacion", sheet.under(/SIT\.?/), (t) => (/^[A-Z]{1,3}$/.test(fold(t)) ? fold(t) : null), { strict: true }),
      // Puede venir vacía legítimamente (póliza en vigor).
      fecha_baja: sheet.accept("poliza.fecha_baja", sheet.after(/F\.?\s?BAJA:?/), parseDate, { emptyIsValid: true, strict: true }),
      cubierto_hasta: sheet.accept("poliza.cubierto_hasta", sheet.after(/GAR\.?\s?\/\s?ASEG\.?\s+A\s+FECHA:?/), parseDate, { strict: true }),
      prima_anual: sheet.accept("poliza.prima_anual", sheet.after(/ANUAL:/), parseAmount, { strict: true }),
      primer_recibo: sheet.accept("poliza.primer_recibo", sheet.after(/1\s?\.\s?REC:/), parseAmount, { strict: true }),
      siguientes_recibos: sheet.accept("poliza.siguientes_recibos", sheet.after(/S\s?\.\s?REC:/), parseAmount, { strict: true }),
      fecha_consulta,
    },
    tomador: {
      nombre: sheet.accept("tomador.nombre", sheet.after(/TOMADOR:/), formatHolderName),
      dni: sheet.accept("tomador.dni", sheet.after(/DNI:?/), parseDni, { strict: true }),
      telefono: sheet.accept("tomador.telefono", sheet.after(/TLF\.?:?/), parsePhone, { strict: true }),
      ...domicilio,
    },
    garantias,
    asegurados,
    dudosos: [...sheet.dudosos].sort(),
    lecturas: sheet.lecturas,
  };
  return consultaAbreviadaSchema.parse(result);
}

/** ¿Tiene el cliente seguro de decesos según las garantías? (solo «sí» si aparece SER.DECESOS). */
export function hasFuneralCoverage(garantias: ConsultaAbreviada["garantias"]) {
  return garantias.some((g) => g.nombre && /SER\.?\s?DECESOS/.test(fold(g.nombre)));
}
