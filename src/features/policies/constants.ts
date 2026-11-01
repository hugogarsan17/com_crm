import type { Enums } from "@/types/database.types";

export type CommissionStatus = Enums<"commission_status">;

export const COMMISSION_STATUSES = ["pending", "confirmed", "paid"] as const satisfies readonly CommissionStatus[];

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  paid: "Pagada",
};

export const COMMISSION_STATUS_STYLES: Record<CommissionStatus, string> = {
  pending: "border border-[#f5c453]/30 bg-[#f5c453]/10 text-[#f8d98a]",
  confirmed: "border border-[#8fb8ff]/30 bg-[#8fb8ff]/10 text-[#b7d0ff]",
  paid: "border border-primary/35 bg-primary/12 text-primary",
};
