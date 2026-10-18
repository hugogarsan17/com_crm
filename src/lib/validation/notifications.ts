import { z } from "zod";

export const UPCOMING_HOURS_OPTIONS = [2, 12, 24, 48, 72, 168] as const;

export const notificationPreferencesSchema = z.object({
  email_enabled: z.boolean(),
  notify_upcoming: z.boolean(),
  upcoming_hours: z.coerce
    .number()
    .int()
    .refine((v) => (UPCOMING_HOURS_OPTIONS as readonly number[]).includes(v), "Elige una de las opciones"),
  notify_overdue: z.boolean(),
});

export type NotificationPreferencesInput = z.input<typeof notificationPreferencesSchema>;
