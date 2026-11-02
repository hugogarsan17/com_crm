import type { OcrWord } from "../consulta-abreviada";

/**
 * Hoja «CONSULTA ABREVIADA» de ejemplo con DATOS INVENTADOS (nombres, DNI, IBAN y
 * teléfonos ficticios). Texto de ancho fijo: cada carácter ocupa una columna.
 */
export const SHEET_LINES = [
  "RAMOS TRADICIONALES          CONSULTA ABREVIADA             02/11/26 10:15:32",
  "PRODU  NUM. POLIZA  FP   SIT  FECHA EFECTO: 01-03-2019    TIPO: FAMILIAR",
  "25001  0012345678   MEN  VI   F.BAJA:                     GAR./ASEG. A FECHA: 31-12-2026",
  "TOMADOR: GARCIA LOPEZ, MARIA ISABEL      DNI: 12345678Z     TLF. 600123456",
  "DOMICILIO DEL TOMADOR                    DOMICILIO DE COBRO",
  "C/ MAYOR 12 3 B                          AV. DEL PUERTO 4",
  "SANT CUGAT - 8172 - BARCELONA            BADALONA - 8911 - BARCELONA",
  "IBAN: ES12 3456 7890 1234 5678 9012",
  "PRIMAS   ANUAL: 245,40    1.REC: 20,45    S.REC: 20,45",
  "SER.DECESOS    SEG.POL.    X/G/P NOMBRE                 REAL DER BAJA     MOT",
  "ASISTENCIA     INCLUIDO    1     GARCIA LOPEZ MARIA IS  54   54",
  "TRASLADO       INCL. 2     2     PEREZ RUIZ JUAN ANTON  57   57",
  "                           3     PEREZ GARCIA LUCIA     12   12  31-12-24 02",
];

const CHAR_W = 10;
const LINE_H = 24;

/**
 * Convierte líneas de ancho fijo en palabras con posición, como las devuelve el OCR.
 * `confidence` permite simular lecturas dudosas de palabras concretas.
 */
export function monospaceWords(lines: string[], confidence: (word: string, line: number) => number = () => 95): OcrWord[] {
  return lines.flatMap((line, li) =>
    [...line.matchAll(/\S+/g)].map((m) => ({
      text: m[0],
      x0: m.index * CHAR_W,
      x1: (m.index + m[0].length) * CHAR_W,
      y0: li * LINE_H,
      y1: li * LINE_H + 16,
      confidence: confidence(m[0], li),
    })),
  );
}
