import { z } from "zod";
import { ACTIVITY_CHANNELS, ACTIVITY_OUTCOMES } from "@/features/activities/constants";
import { LEAD_STATUSES } from "@/features/leads/constants";
import { localDateTime, optionalLocalDateTime, optionalText } from "@/lib/validation/common";

export const logActivitySchema = z
  .object({
    lead_id: z.uuid(),
    channel: z.enum(ACTIVITY_CHANNELS, "Selecciona un canal"),
    outcome: z.enum(ACTIVITY_OUTCOMES, "Selecciona un resultado"),
    occurred_at: localDateTime,
    summary: optionalText(2000),
    new_status: z.union([z.enum(LEAD_STATUSES), z.literal("")]).transform((v) => (v === "" ? null : v)),
    closed_reason: optionalText(500),
    schedule_follow_up: z.boolean(),
    follow_up_title: optionalText(200),
    follow_up_due_at: optionalLocalDateTime,
  })
  .superRefine((v, ctx) => {
    if (!v.schedule_follow_up) return;
    if (!v.follow_up_due_at) {
      ctx.addIssue({ code: "custom", path: ["follow_up_due_at"], message: "Indica la fecha del seguimiento" });
    }
  });

export type LogActivityInput = z.input<typeof logActivitySchema>;
