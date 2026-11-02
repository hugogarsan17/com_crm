import type { OcrWord } from "../consulta-abreviada";

/**
 * Hoja «CONSULTA ABREVIADA» de ejemplo con la MISMA DISPOSICIÓN que las hojas reales
 * (columnas, separadores «|», cabecera «--F.BAJA--», línea «|ANUAL:», domicilio de cobro
 * e IBAN a la derecha) y DATOS INVENTADOS: nombres, DNI, IBAN, teléfono y direcciones
 * son ficticios. Texto de ancho fijo: cada carácter ocupa una columna.
 */
export const SHEET_LINES = [
  "ASEGURADORA, S.A.         SISTEMA RAMOS TRADICIONALES             02/11/26  10:15:32",
  "CONSULTA ABREVIADA        GES. DE CONTRATOS DE PÓLIZAS            TH1      ABCD12X",
  "PRODU  NUM. POLIZA GEST COBR SUPL AGTE INSP COB RES      FP SIT --F.BAJA-- MO",
  "25001     0012345678  0101 0101             555 11       MEN VI",
  "FECHA EFECTO: 01-03-2019 TIPO: TS             GAR./ ASEG. A FECHA: 31-12-2026",
  "TOMADOR: MARIA ISABEL GARCIA LOPEZ            DNI:  12345678Z TLF. 600123456",
  "------- DOMICILIO DEL TOMADOR --------  --------- DOMICILIO DE COBRO --------",
  "CL MAYOR , 0012 3-B                     IBAN: ES12-3456-7890-1234-5678-9012",
  "S CUGAT DEL VALLES - 8172 - BARCELONA   AV. DEL PUERTO, 4 - BADALONA",
  "SER.DECESOS   SEG.POL. *** |X/G/P       NOMBRE           REAL DER   BAJA   MOT",
  "PR.INTEGRAL   INCL.  5     | _  1 MARIA ISABEL GARCIA LO 54   40",
  "ASIS. VIAJE   INCLUIDO     | _  2 JUAN ANTONIO PEREZ RUI 57   45",
  "AS.EXTRANJ.   INCLUIDO     | _  3 LUCIA PEREZ GARCIA     12    2   31-12-24 02",
  "AC.MUERTE     SEG.POL.     |",
  "                           |",
  "                           |------------------------------------------------",
  "                           |ANUAL:   245,40 1.REC:     20,45 S.REC:     20,45",
  "Enter-PF1---PF2---PF3---PF4---PF5---PF6---PF7---PF8---PF9---PF10--PF11--PF12---",
  "     SERV REC.  SALIR        NAV.  MOV.  PG.-  PG.+  DESG  SINI  -->",
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
