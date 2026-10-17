"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { AlertCircleIcon, CheckCircle2Icon, FileUpIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { callAction } from "@/components/form/fields";
import { toCsv } from "@/lib/csv";
import { IMPORT_BATCH_SIZE, type ImportRow } from "@/lib/validation/import";
import { checkDuplicates, importLeadsBatch } from "../actions";
import {
  chunk,
  collectKeys,
  guessMapping,
  IMPORT_FIELDS,
  markDuplicates,
  MAX_IMPORT_ROWS,
  summarize,
  validateRecords,
  type ColumnMapping,
  type CsvRecord,
  type ImportFieldKey,
  type ParsedRow,
} from "../csv";

type Step = "upload" | "map" | "review" | "importing" | "done";
type BatchResult = { rows: ImportRow[]; ok: boolean; inserted: number; error?: string };

const NONE = "__none__";
const MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_LIMIT = 200;

function StepIndicator({ step }: { step: Step }) {
  const steps: [Step[], string][] = [
    [["upload"], "1. Archivo"],
    [["map"], "2. Columnas"],
    [["review"], "3. Revisión"],
    [["importing", "done"], "4. Importación"],
  ];
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Pasos">
      {steps.map(([keys, label]) => (
        <li
          key={label}
          aria-current={keys.includes(step) ? "step" : undefined}
          className={keys.includes(step) ? "rounded-full bg-primary px-3 py-1 text-primary-foreground" : "rounded-full bg-muted px-3 py-1 text-muted-foreground"}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard({ timezone }: { timezone: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [encoding, setEncoding] = useState("UTF-8");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<CsvRecord[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BatchResult[]>([]);

  const fileInput = useRef<HTMLInputElement>(null);

  // Si se eligió un archivo antes de que la página terminara de cargar (hidratación),
  // el evento change se pierde: lo procesamos al montar.
  useEffect(() => {
    const pending = fileInput.current?.files?.[0];
    if (pending) onFile(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => summarize(rows), [rows]);
  const toImport = useMemo(
    () => rows.filter((r) => r.value && (includeDuplicates || !r.duplicate)).map((r) => r.value!),
    [rows, includeDuplicates],
  );

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRecords([]);
    setMapping(null);
    setRows([]);
    setResults([]);
    setError(null);
    setFileName("");
  }

  function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("El archivo supera 5 MB. Divídelo en varios archivos.");
      return;
    }
    setBusy(true);
    Papa.parse<CsvRecord>(file, {
      header: true,
      skipEmptyLines: "greedy",
      encoding,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        setBusy(false);
        const fields = (res.meta.fields ?? []).filter(Boolean);
        if (fields.length === 0 || res.data.length === 0) {
          setError("No se han encontrado filas. Comprueba que el archivo tiene una fila de cabeceras.");
          return;
        }
        if (res.data.length > MAX_IMPORT_ROWS) {
          setError(`El archivo tiene ${res.data.length} filas. El máximo por importación es ${MAX_IMPORT_ROWS}.`);
          return;
        }
        setFileName(file.name);
        setHeaders(fields);
        setRecords(res.data);
        setMapping(guessMapping(fields));
        setStep("map");
      },
      error: () => {
        setBusy(false);
        setError("No se pudo leer el archivo. ¿Es un CSV válido?");
      },
    });
  }

  async function validate() {
    if (!mapping) return;
    if (!mapping.full_name) {
      setError("Asigna la columna del nombre: es obligatoria.");
      return;
    }
    setError(null);
    setBusy(true);
    const parsed = validateRecords(records, mapping, timezone);
    const result = await callAction(() => checkDuplicates(collectKeys(parsed)));
    setBusy(false);
    if (!result.ok) {
      setError(`No se pudieron comprobar los duplicados: ${result.error}`);
      return;
    }
    setRows(markDuplicates(parsed, result.data));
    setStep("review");
  }

  async function runImport(batches: ImportRow[][]) {
    setStep("importing");
    setProgress({ done: 0, total: batches.length });
    const out: BatchResult[] = [];
    // Lotes secuenciales: cada lote es atómico en la base de datos.
    for (const batch of batches) {
      const r = await callAction(() => importLeadsBatch(batch));
      out.push(r.ok ? { rows: batch, ok: true, inserted: r.data.inserted } : { rows: batch, ok: false, inserted: 0, error: r.error });
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setResults((prev) => [...prev.filter((b) => b.ok), ...out]);
    setStep("done");
  }

  const inserted = results.reduce((s, b) => s + b.inserted, 0);
  const failedBatches = results.filter((b) => !b.ok);
  const failedRows = failedBatches.reduce((s, b) => s + b.rows.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <StepIndicator step={step} />
      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Selecciona un archivo CSV</CardTitle>
            <CardDescription>
              La primera fila debe contener los nombres de las columnas. Máximo {MAX_IMPORT_ROWS} filas y 5 MB. El archivo se
              procesa en tu navegador; solo se envían las filas que confirmes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="encoding">Codificación</Label>
              <Select value={encoding} onValueChange={setEncoding}>
                <SelectTrigger id="encoding" className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTF-8">UTF-8 (recomendado)</SelectItem>
                  <SelectItem value="windows-1252">Windows-1252 (Excel antiguo)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Si ves caracteres raros (Ã©, ?) en la vista previa, prueba la otra opción.</p>
            </div>
            <label
              htmlFor="csv-file"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/50"
            >
              {busy ? <Loader2Icon className="size-8 animate-spin" aria-hidden /> : <FileUpIcon className="size-8 text-muted-foreground" aria-hidden />}
              <span className="font-medium">Pulsa para elegir el archivo</span>
              <span className="text-sm text-muted-foreground">.csv separado por comas o punto y coma</span>
              <input
                ref={fileInput}
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
          </CardContent>
        </Card>
      ) : null}

      {step === "map" && mapping ? (
        <Card>
          <CardHeader>
            <CardTitle>Asigna las columnas</CardTitle>
            <CardDescription>
              {fileName}: {records.length} filas. Hemos propuesto una asignación; revísala.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <Label htmlFor={`map-${field.key}`}>
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Select
                    value={mapping[field.key] || NONE}
                    onValueChange={(v) => setMapping({ ...mapping, [field.key as ImportFieldKey]: v === NONE ? "" : v })}
                  >
                    <SelectTrigger id={`map-${field.key}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— No importar —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Vista previa (primeras 5 filas)</p>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="max-w-48 truncate">
                            {r[h]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="lg" onClick={reset}>
                Elegir otro archivo
              </Button>
              <Button size="lg" onClick={validate} disabled={busy}>
                {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
                Validar filas
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "review" ? (
        <Card>
          <CardHeader>
            <CardTitle>Revisa antes de importar</CardTitle>
            <CardDescription>Nada se guarda hasta que confirmes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Filas en el archivo", summary.total, ""],
                ["Válidas y nuevas", summary.clean, "text-emerald-700"],
                ["Posibles duplicados", summary.duplicates, "text-amber-700"],
                ["Con errores (no se importan)", summary.invalid, "text-destructive"],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</dd>
                </div>
              ))}
            </dl>

            {summary.duplicates > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border p-3">
                <Checkbox id="include-dups" checked={includeDuplicates} onCheckedChange={(c) => setIncludeDuplicates(c === true)} />
                <div>
                  <Label htmlFor="include-dups">Importar también los posibles duplicados</Label>
                  <p className="text-sm text-muted-foreground">
                    Por defecto se omiten las filas cuyo teléfono, email o referencia ya existe en tus fichas o se repite en el archivo.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Línea</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows]
                    .sort((a, b) => Number(!!a.value && !a.duplicate) - Number(!!b.value && !b.duplicate))
                    .slice(0, PREVIEW_LIMIT)
                    .map((r) => (
                      <TableRow key={r.line}>
                        <TableCell className="tabular-nums">{r.line}</TableCell>
                        <TableCell className="max-w-48 truncate">{r.value?.full_name ?? (mapping ? r.record[mapping.full_name] : "")}</TableCell>
                        <TableCell>{r.value?.phone ?? (mapping?.phone ? r.record[mapping.phone] : "")}</TableCell>
                        <TableCell className="max-w-48 truncate">{r.value?.email ?? (mapping?.email ? r.record[mapping.email] : "")}</TableCell>
                        <TableCell className="text-sm">
                          {!r.value ? (
                            <span className="text-destructive">{r.errors.join(" · ")}</span>
                          ) : r.duplicate ? (
                            <span className="text-amber-700">
                              Duplicado por {r.duplicate.field} {r.duplicate.source === "existing" ? "con la ficha" : "con"} {r.duplicate.matchName}
                            </span>
                          ) : (
                            <span className="text-emerald-700">Lista para importar</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > PREVIEW_LIMIT ? (
              <p className="text-xs text-muted-foreground">Se muestran {PREVIEW_LIMIT} de {rows.length} filas (primero las que tienen incidencias).</p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" size="lg" onClick={() => setStep("map")}>
                  Volver a las columnas
                </Button>
                {summary.invalid > 0 ? (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() =>
                      downloadText(
                        "filas-con-errores.csv",
                        toCsv(
                          ["Línea", "Errores", ...headers],
                          rows.filter((r) => !r.value).map((r) => [r.line, r.errors.join(" · "), ...headers.map((h) => r.record[h] ?? "")]),
                        ),
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    Descargar filas con errores
                  </Button>
                ) : null}
              </div>
              <Button size="lg" disabled={toImport.length === 0} onClick={() => runImport(chunk(toImport, IMPORT_BATCH_SIZE))}>
                Importar {toImport.length} {toImport.length === 1 ? "ficha" : "fichas"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "importing" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10" role="status" aria-live="polite">
            <Loader2Icon className="size-8 animate-spin" aria-hidden />
            <p>
              Importando lote {Math.min(progress.done + 1, progress.total)} de {progress.total}…
            </p>
            <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">No cierres esta página.</p>
          </CardContent>
        </Card>
      ) : null}

      {step === "done" ? (
        <Card>
          <CardHeader>
            <CardTitle>Resultado de la importación</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert>
              <CheckCircle2Icon />
              <AlertTitle>{inserted} fichas importadas</AlertTitle>
              <AlertDescription>
                {summary.invalid > 0 ? `${summary.invalid} filas con errores no se importaron. ` : ""}
                {!includeDuplicates && summary.duplicates > 0 ? `${summary.duplicates} posibles duplicados se omitieron.` : ""}
              </AlertDescription>
            </Alert>
            {failedBatches.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>
                  {failedRows} filas no se guardaron ({failedBatches.length} {failedBatches.length === 1 ? "lote" : "lotes"})
                </AlertTitle>
                <AlertDescription>
                  <p>
                    Cada lote de hasta {IMPORT_BATCH_SIZE} filas se guarda completo o no se guarda: no hay filas a medias. Motivo:{" "}
                    {failedBatches[0].error}
                  </p>
                  <Button className="mt-2" variant="outline" onClick={() => runImport(failedBatches.map((b) => b.rows))}>
                    <RotateCcwIcon aria-hidden /> Reintentar solo las filas fallidas
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/leads?sort=updated_desc">Ver fichas</Link>
              </Button>
              <Button variant="outline" size="lg" onClick={reset}>
                Importar otro archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
