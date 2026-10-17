import type { Enums } from "@/types/database.types";

export type CommissionStatus = Enums<"commission_status">;

export const COMMISSION_STATUSES = ["pending", "confirmed", "paid"] as const satisfies readonly CommissionStatus[];

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  paid: "Pagada",
};

export const COMMISSION_STATUS_STYLES: Record<CommissionStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  confirmed: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};
