"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ResultsSeries } from "@/features/reports/queries";
import type { Bucket } from "@/features/reports/period";

/** Paleta categórica validada (orden fijo; ver skill dataviz). */
const SERIES = [
  { key: "contacted", label: "Clientes contactados", color: "#2a78d6" },
  { key: "contracted", label: "Pólizas contratadas", color: "#eb6834" },
  { key: "rejected", label: "Rechazos", color: "#1baf7a" },
] as const;

function bucketLabel(bucket: string, granularity: Bucket) {
  const d = new Date(`${bucket}T00:00:00Z`);
  if (granularity === "month") return new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" }).format(d);
  const label = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
  return granularity === "week" ? `Sem. ${label}` : label;
}

export function ResultsChart({ data, bucket }: { data: ResultsSeries; bucket: Bucket }) {
  const rows = data.map((d) => ({ ...d, label: bucketLabel(d.bucket, bucket) }));
  const empty = rows.every((r) => SERIES.every((s) => r[s.key] === 0));

  return (
    <figure className="flex flex-col gap-3">
      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sin actividad en este periodo.</p>
      ) : (
        <div className="h-64 w-full" role="img" aria-label="Evolución de resultados en el periodo; datos en la tabla siguiente">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#e7e6e2" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#52514e" }} minTickGap={16} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#52514e" }} width={40} />
              <Tooltip
                cursor={{ stroke: "#a3a29b", strokeWidth: 1 }}
                contentStyle={{ borderRadius: 8, fontSize: 13, borderColor: "#e7e6e2" }}
                labelStyle={{ color: "#0b0b0b", fontWeight: 600 }}
                itemStyle={{ color: "#0b0b0b" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconType="plainline"
                itemSorter={null}
                formatter={(value) => <span style={{ color: "#52514e" }}>{value}</span>}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={rows.length <= 14 ? { r: 4, strokeWidth: 2, stroke: "#fcfcfb" } : false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fcfcfb" }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground">Ver datos en tabla</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="px-2 py-1 font-medium">Periodo</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-2 py-1 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.bucket} className="border-t">
                  <td className="px-2 py-1">{r.label}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-2 py-1 text-right tabular-nums">
                      {r[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
