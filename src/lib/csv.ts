/** Utilidades de exportación CSV (separador ";" y BOM para que Excel en español lo abra bien). */
export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value).replace(".", ",") : String(value);
  // Evita inyección de fórmulas al abrir en hojas de cálculo.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
