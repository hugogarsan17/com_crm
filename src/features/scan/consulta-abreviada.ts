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
/** Identificadores críticos (nº de póliza): un dígito cambiado no lo detecta ningún formato. */
export const MIN_CONFIDENCE_CRITICAL = 90;

/**
 * Garantías vistas en las hojas. Si una lectura coincide con una de ellas (sin contar
 * puntuación y aceptando la confusión M/N típica de esta tipografía) se acepta con su
 * nombre canónico aunque Tesseract dé poca confianza: es un vocabulario cerrado.
 */
export const GARANTIAS_CONOCIDAS = [
  "SER.DECESOS",
  "PR.INTEGRAL",
  "ASIS. VIAJE",
  "AS.EXTRANJ.",
  "RES.MUNDIAL",
  "ABOGADO FAM",
  "AT.MED.DENT",
  "AC.MUERTE",
  "AC.MTE.CIRC",
];

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

// Separadores de la pantalla y ruido del OCR («|», «_», «***», «»», «—»…). El guion simple
// se conserva porque separa municipio, CP y provincia.
const DECORATION_RE = /^[|_!¡;:[\]{}()“”"'`´~=*»«$.·•—–]+$/;

/** Quita comillas o símbolos pegados a un número («$50», «“5»): marcas del borde, no cifras. */
function cleanWord(w: OcrWord): OcrWord {
  const m = /^[$“”"'`´]+(\d+)$/.exec(w.text);
  return m ? { ...w, text: m[1] } : w;
}

function isNoise(w: OcrWord) {
  return w.text !== "-" && (DECORATION_RE.test(w.text) || (w.text.length <= 2 && w.confidence < 10 && !/^\d+$/.test(w.text)));
}

/** Elimina el IBAN (etiqueta y número) antes de procesar: nunca llega al resultado. */
export function stripIban(lines: OcrLine[]): OcrLine[] {
  return lines
    .filter((line) => !/^\W*IBAN\b/.test(fold(line.map((w) => w.text).join(" "))))
    .map((line) => {
      const text = line.map((w) => w.text).join(" ");
      const match = IBAN_RE.exec(fold(text));
      let pos = 0;
      return line.filter((w) => {
        const start = pos;
        pos += w.text.length + 1;
        if (/^IBAN:?$/i.test(w.text)) return false;
        return !match || start + w.text.length <= match.index || start >= match.index + match[0].length;
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
// Palabra que es una etiqueta («TLF.», «DNI:», «1.REC:»): corta el valor de la anterior.
const LABEL_WORD_RE = /^(?:[A-Z0-9][A-Z0-9./]*:|TLF\.?)$/;

function untilLabel(words: OcrWord[]) {
  const i = words.findIndex((w) => LABEL_WORD_RE.test(fold(w.text)));
  return i < 0 ? words : words.slice(0, i);
}

const cyOf = (w: OcrWord) => (w.y0 + w.y1) / 2;

// -----------------------------------------------------------------------------
// Lector
// -----------------------------------------------------------------------------
class Sheet {
  readonly cw: number;
  readonly segs: Segment[][];
  readonly dudosos = new Set<string>();
  readonly lecturas: Record<string, string> = {};

  /** `ibanX`: posición horizontal donde estaba el IBAN (solo la posición; el valor se descarta). */
  constructor(
    readonly lines: OcrLine[],
    readonly ibanX: number | null = null,
  ) {
    this.cw = charWidth(lines);
    this.segs = lines.map((l) => segments(l, this.cw));
  }

  get words() {
    return this.lines.flat();
  }

  /** Valor tras una etiqueta en la misma línea. `found: false` si la etiqueta no aparece. */
  after(label: RegExp): { found: boolean; value: Reading } {
    for (const lineSegs of this.segs) {
      for (let i = 0; i < lineSegs.length; i++) {
        const seg = lineSegs[i];
        // La etiqueta puede ir pegada a un separador («|ANUAL:»).
        const m = new RegExp(`^(?:.*?[^A-Z0-9])?(${label.source})\\s*`, "i").exec(fold(seg.text));
        if (!m) continue;
        const own = untilLabel(wordsAfter(seg.words, m[0].length));
        if (own.length) return { found: true, value: reading(own) };
        const next = lineSegs[i + 1];
        if (next && !LOOKS_LIKE_LABEL.test(fold(next.text))) {
          const value = untilLabel(next.words);
          return { found: true, value: value.length ? reading(value) : null };
        }
        return { found: true, value: null };
      }
    }
    return { found: false, value: null };
  }

  /**
   * Valor situado debajo de una cabecera: palabras que empiezan bajo ella y antes de la
   * cabecera siguiente. Se busca en las dos líneas siguientes (con la perspectiva de una
   * foto, la columna derecha puede quedar una línea más abajo) sin pasar de una línea
   * con etiquetas.
   */
  under(header: RegExp): { found: boolean; value: Reading } {
    for (let li = 0; li < this.lines.length - 1; li++) {
      const words = this.lines[li];
      for (let wi = 0; wi < words.length; wi++) {
        const rest = fold(words.slice(wi).map((w) => w.text).join(" "));
        const m = new RegExp(`^(${header.source})(?![A-Z])`, "i").exec(rest);
        if (!m) continue;
        const nWords = m[1].trim().split(/\s+/).length;
        const hx0 = words[wi].x0;
        const hx1 = words[wi + nWords - 1].x1;
        const nextHeader = words[wi + nWords];
        const toX = nextHeader ? nextHeader.x0 - this.cw * 0.5 : hx1 + this.cw * 2;
        for (const line of this.lines.slice(li + 1, li + 3)) {
          if (line.some((w) => /:$/.test(w.text))) break;
          const below = line.filter((w) => w.x0 >= hx0 - this.cw * 1.5 && w.x0 < toX);
          if (below.length) return { found: true, value: reading(below) };
        }
        return { found: true, value: null };
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
    { emptyIsValid = false, strict = false, critical = false }: { emptyIsValid?: boolean; strict?: boolean; critical?: boolean } = {},
  ): T | null {
    if (!r.value) {
      if (!(emptyIsValid && r.found)) this.dudosos.add(path);
      return null;
    }
    const parsed = parse(r.value.text.trim());
    const min = critical ? MIN_CONFIDENCE_CRITICAL : strict ? MIN_CONFIDENCE_STRICT : MIN_CONFIDENCE;
    if (parsed === null || r.value.confidence < min) {
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
const CITY_RE = /^.+\s[-–—]\s*\d{4,5}\s*[-–—]\s.+$/;

function readTomadorAddress(sheet: Sheet) {
  const result = { domicilio: null as string | null, municipio: null as string | null, codigo_postal: null as string | null, provincia: null as string | null };
  // «DOMICILIO DEL TOMADOR» (la primera palabra a veces se lee mal: basta «DEL TOMADOR»).
  const headerLine = sheet.segs.findIndex((segs) => segs.some((s) => /\bDEL\s+TO[MN]ADOR\b/.test(fold(s.text))));
  if (headerLine < 0) {
    for (const k of ["domicilio", "municipio", "codigo_postal", "provincia"]) sheet.dudosos.add(`tomador.${k}`);
    return result;
  }
  // A la derecha van el domicilio de cobro y el IBAN: se toma solo la primera columna
  // (hasta la cabecera de cobro o el IBAN, si se leen, y en todo caso el primer segmento).
  const nearby = sheet.lines.slice(headerLine, headerLine + 5).flat();
  const rightEdges = [
    ...sheet.segs.slice(headerLine, headerLine + 2).flatMap((segs) => segs.filter((s) => /DOMICILIO\s+DE\s+COBRO/.test(fold(s.text))).map((s) => s.x0)),
    ...nearby.filter((w) => /^IBAN/i.test(w.text)).map((w) => w.x0),
    ...(sheet.ibanX !== null ? [sheet.ibanX] : []),
  ];
  const maxX = rightEdges.length ? Math.min(...rightEdges) - sheet.cw : Infinity;
  const block = sheet.lines.slice(headerLine + 1, headerLine + 5).map((line) => {
    const left = line.filter((w) => w.x1 <= maxX + sheet.cw);
    if (left.length === 0 || maxX !== Infinity) return left;
    // Sin referencia de la columna de cobro: se corta en el primer hueco grande (dentro de una
    // dirección los huecos no pasan de ~1,6 caracteres; entre columnas hay 3 o más).
    const cut = left.findIndex((w, i) => i > 0 && w.x0 - left[i - 1].x1 > sheet.cw * 2.5);
    return cut < 0 ? left : left.slice(0, cut);
  });

  const cityIdx = block.findIndex((l) => CITY_RE.test(l.map((w) => w.text).join(" ")));
  // El domicilio es la línea anterior a la de «MUNICIPIO - CP - PROVINCIA».
  const addressWords = cityIdx > 0 ? block[cityIdx - 1] : [];
  result.domicilio = sheet.accept("tomador.domicilio", { found: true, value: reading(addressWords) }, (t) =>
    parseText(200)(t.replace(/\s+,/g, ",")),
  );

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
    [munR, cpR, provR] = texts.length === 3 ? texts.map((t) => (t ? { text: t, confidence: conf } : null)) : [null, null, null];
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

/** Clave para comparar con el vocabulario: solo letras y M=N (confusión típica del OCR). */
const vocabKey = (t: string) => fold(t).replace(/[^A-Z]/g, "").replace(/M/g, "N");
const GARANTIAS_BY_KEY = new Map(GARANTIAS_CONOCIDAS.map((g) => [vocabKey(g), g]));

/** Estado de garantía canónico si la lectura es exactamente uno de los conocidos. */
function canonicalEstado(text: string): string | null {
  const key = fold(text).replace(/[^A-Z0-9]/g, "");
  // Se admiten hasta 2 caracteres del borde de la tabla pegados delante («1INCLUIDO», «5SEG»),
  // pero no letras mal leídas («EG POL»): eso queda como dudoso.
  const candidates = [key];
  if (/^[0-9I]/.test(key)) candidates.push(key.slice(1));
  if (/^[0-9I]{2}/.test(key)) candidates.push(key.slice(2));
  for (const k of candidates) {
    if (k === "SEGPOL") return "SEG.POL.";
    if (k === "INCLUIDO") return "INCLUIDO";
    const incl = /^INCL(\d{1,2})$/.exec(k);
    if (incl) return `INCL. ${incl[1]}`;
  }
  return null;
}

function readTable(sheet: Sheet) {
  const garantias: ConsultaAbreviada["garantias"] = [];
  const asegurados: ConsultaAbreviada["asegurados"] = [];
  const words = sheet.words;

  // Cabecera de la tabla de asegurados (la marca «X/G/P» suele leerse mal; NOMBRE, REAL y DER no).
  const header = sheet.lines.find((l) => {
    const t = fold(l.map((w) => w.text).join(" "));
    return /\bNOMBRE\b/.test(t) && /\bREAL\b/.test(t) && /\bDER\b/.test(t);
  });
  if (!header) {
    sheet.dudosos.add("asegurados");
    return { garantias, asegurados };
  }
  const nombre = header.find((w) => fold(w.text) === "NOMBRE")!;
  const lineH = nombre.y1 - nombre.y0;
  const headerTop = Math.min(...header.map(cyOf));
  const marker = header.filter((w) => w.x1 <= nombre.x0 && w.text.includes("/")).pop();
  const tableX0 = (marker ? marker.x0 : nombre.x0 - sheet.cw * 8) - sheet.cw;
  // Fin de la tabla: la línea de primas («ANUAL: … 1.REC: … S.REC: …»).
  const totals = sheet.lines.find((l) => l.some((w) => /REC:$/.test(fold(w.text))));
  // Con perspectiva, una misma fila no está a la misma altura de lado a lado: se usa la fila entera.
  const top = headerTop - lineH / 2;
  const bottom = totals ? Math.min(...totals.map(cyOf)) - lineH / 2 : Infinity;
  const inBand = (w: OcrWord) => cyOf(w) >= top && cyOf(w) < bottom;

  // Garantías (columna izquierda), agrupadas por filas por separado de la tabla.
  const leftLines = groupWordsIntoLines(words.filter((w) => inBand(w) && w.x1 <= tableX0));
  const estadoXs = leftLines
    .flat()
    .filter((w) => /INCL|POL|^S?EG\b/.test(fold(w.text)))
    .map((w) => w.x0)
    .sort((a, b) => a - b);
  const estadoX = estadoXs.length ? estadoXs[Math.floor(estadoXs.length / 2)] - sheet.cw : Infinity;
  for (const line of leftLines) {
    // El estado empieza en la primera palabra con SEG/INCL/POL (aunque lleve restos delante);
    // si no hay, se usa la columna de los estados.
    let start = line.findIndex((w) => /SEG|INCL|POL|^\W*\d?EG\W*$/.test(fold(w.text)));
    if (start < 0) start = line.findIndex((w) => w.x0 >= estadoX);
    if (start < 0) start = line.length;
    let nameWords = line.slice(0, start).filter((w) => w.text !== ",");
    // Restos del OCR al final del nombre («ABOGADO FAM 1»).
    while (nameWords.length > 1 && !/\p{L}{2}/u.test(nameWords[nameWords.length - 1].text)) nameWords = nameWords.slice(0, -1);
    const estadoWords = line.slice(start);
    if (nameWords.length === 0 && estadoWords.length === 0) continue;
    const i = garantias.length;
    const known = GARANTIAS_BY_KEY.get(vocabKey(nameWords.map((w) => w.text).join("")));
    const estado = canonicalEstado(estadoWords.map((w) => w.text).join(" "));
    garantias.push({
      nombre: known
        ? known
        : sheet.accept(`garantias.${i}.nombre`, { found: true, value: reading(nameWords) }, (t) => (/\p{L}{3}/u.test(t) && t.length <= 80 ? fold(t) : null)),
      estado: estado ?? sheet.accept(`garantias.${i}.estado`, { found: true, value: reading(estadoWords) }, () => null),
    });
  }

  // Asegurados: filas de la columna derecha que empiezan por el número de orden.
  // «nº NOMBRE… REAL DER [BAJA [MOT]]»; el nombre viene truncado y se guarda tal cual.
  const rightLines = groupWordsIntoLines(words.filter((w) => inBand(w) && w.x0 >= tableX0 && cyOf(w) > cyOf(nombre) + lineH / 2));
  for (const line of rightLines) {
    if (!/^\d{1,2}$/.test(line[0]?.text ?? "")) continue;
    const i = asegurados.length;
    const rest = line.slice(1);
    let end = rest.length;
    const isDate = (w?: OcrWord) => Boolean(w && parseDate(w.text));
    const isInt = (w?: OcrWord) => Boolean(w && /^\d{1,3}$/.test(w.text));
    let motivo: OcrWord[] = [];
    let baja: OcrWord[] = [];
    if (end >= 2 && !isDate(rest[end - 1]) && isDate(rest[end - 2])) motivo = [rest[--end]];
    if (isDate(rest[end - 1])) baja = [rest[--end]];
    const der = isInt(rest[end - 1]) ? [rest[--end]] : [];
    const real = isInt(rest[end - 1]) ? [rest[--end]] : [];
    const nameWords = rest.slice(0, end);
    const cell = (ws: OcrWord[]) => ({ found: true, value: reading(ws) });
    asegurados.push({
      orden: sheet.accept(`asegurados.${i}.orden`, cell([line[0]]), parseInt0, { strict: true }),
      nombre: sheet.accept(`asegurados.${i}.nombre`, cell(nameWords), parseText(80)),
      edad_real: sheet.accept(`asegurados.${i}.edad_real`, cell(real), parseInt0, { strict: true }),
      edad_derecho: sheet.accept(`asegurados.${i}.edad_derecho`, cell(der), parseInt0, { strict: true }),
      baja: sheet.accept(`asegurados.${i}.baja`, cell(baja), parseDate, { emptyIsValid: true, strict: true }),
      motivo: sheet.accept(`asegurados.${i}.motivo`, cell(motivo), (t) => (/^[A-Z0-9]{1,4}$/.test(fold(t)) ? fold(t) : null), { emptyIsValid: true, strict: true }),
    });
  }
  return { garantias, asegurados };
}

function fechaBajaReading(sheet: Sheet) {
  const r = sheet.under(/-*F\.?\s?BAJA-*/);
  return r.found ? r : sheet.after(/F\.?\s?BAJA:/);
}

/** Prima anual: tras «ANUAL:»; si esa etiqueta no se lee, es el importe justo antes de «1.REC:». */
function annualPremiumReading(sheet: Sheet) {
  const r = sheet.after(/ANUAL:/);
  if (r.found) return r;
  for (const line of sheet.lines) {
    const i = line.findIndex((w) => /^1\s?\.?\s?REC:$/.test(fold(w.text)));
    if (i > 0 && parseAmount(line[i - 1].text) !== null) return { found: true, value: reading([line[i - 1]]) };
  }
  return { found: false, value: null };
}

/** ¿El texto reconocido es una hoja «Consulta abreviada»? */
export function isConsultaAbreviada(lines: OcrLine[]) {
  const text = fold(lines.map((l) => l.map((w) => w.text).join(" ")).join("\n"));
  return /CONSULTA\s+ABREVIADA/.test(text) || (/TO[MN]ADOR/.test(text) && /NU[MN]\.?\s*POLIZA/.test(text));
}

/** Extrae y valida todos los datos de la hoja. */
export function parseConsultaAbreviada(rawLines: OcrLine[]): ConsultaAbreviada {
  const clean = rawLines.map((l) => l.filter((w) => !isNoise(w)).map(cleanWord)).filter((l) => l.length > 0);
  // Antes de borrar el IBAN se anota dónde estaba: marca el inicio de la columna de cobro.
  const ibanWords = clean.flat().filter((w) => /^IBAN/i.test(w.text) || IBAN_RE.test(fold(w.text)));
  const lines = stripIban(clean);
  const sheet = new Sheet(lines, ibanWords.length ? Math.min(...ibanWords.map((w) => w.x0)) : null);

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
      numero_poliza: sheet.accept("poliza.numero_poliza", sheet.under(/NU[MN]\.?\s*POLIZA/), (t) => {
        const v = fold(t).replace(/\s/g, "");
        return /^[A-Z0-9-]{4,20}$/.test(v) && /\d{4}/.test(v) ? v : null;
      }, { critical: true }),
      fecha_efecto: sheet.accept("poliza.fecha_efecto", sheet.after(/FEC[HN]A\s+[A-Z]?FECTO:?/), parseDate, { strict: true }),
      tipo: sheet.accept("poliza.tipo", sheet.after(/TIPO:/), parseText(60)),
      forma_pago: sheet.accept("poliza.forma_pago", sheet.under(/FP/), (t) => (fold(t) in FORMAS_PAGO ? fold(t) : null), { strict: true }),
      situacion: sheet.accept("poliza.situacion", sheet.under(/SIT\.?/), (t) => (/^[A-Z]{1,3}$/.test(fold(t)) ? fold(t) : null), { strict: true }),
      // Puede venir vacía legítimamente (póliza en vigor).
      // Cabecera «--F.BAJA--» con el valor debajo (o «F.BAJA:»); vacía si la póliza está en vigor.
      fecha_baja: sheet.accept("poliza.fecha_baja", fechaBajaReading(sheet), parseDate, { emptyIsValid: true, strict: true }),
      cubierto_hasta: sheet.accept("poliza.cubierto_hasta", sheet.after(/GAR\.?\s?\/\s?ASEG\.?\s+A\s+FECHA:?/), parseDate, { strict: true }),
      prima_anual: sheet.accept("poliza.prima_anual", annualPremiumReading(sheet), parseAmount, { strict: true }),
      primer_recibo: sheet.accept("poliza.primer_recibo", sheet.after(/1\s?\.\s?REC:/), parseAmount, { strict: true }),
      siguientes_recibos: sheet.accept("poliza.siguientes_recibos", sheet.after(/S\s?\.\s?REC:/), parseAmount, { strict: true }),
      fecha_consulta,
    },
    tomador: {
      nombre: sheet.accept("tomador.nombre", sheet.after(/TO[MN]ADOR:/), formatHolderName),
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
