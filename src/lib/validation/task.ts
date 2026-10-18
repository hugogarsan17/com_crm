import { z } from "zod";
import { localDateTime, optionalText, requiredText } from "@/lib/validation/common";

export const taskSchema = z.object({
  lead_id: z.uuid(),
  title: requiredText(200, "Indica qué hay que hacer"),
  description: optionalText(2000),
  due_at: localDateTime,
});

export type TaskInput = z.input<typeof taskSchema>;

/** Edición de una tarea (título, detalles, fecha y ficha vinculada). */
export const updateTaskSchema = taskSchema.extend({ task_id: z.uuid() });

export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const leadSearchSchema = z.string().trim().max(100);

export const taskIdSchema = z.object({ task_id: z.uuid() });

export const postponeTaskSchema = z.union([
  z.object({ task_id: z.uuid(), days: z.number().int().min(1).max(365) }),
  z.object({ task_id: z.uuid(), due_at: localDateTime }),
]);

export type PostponeTaskInput = z.input<typeof postponeTaskSchema>;
