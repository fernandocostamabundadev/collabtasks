import { z } from "zod";

import type {
  CreateTaskInput,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types.js";

const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "completed",
  "cancelled",
]);

const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const optionalIdSchema = z.string().trim().min(1, "O identificador é inválido.");
const nullableIdSchema = optionalIdSchema.nullable();
const dateSchema = z.iso.datetime().transform((value) => new Date(value));

export const createTaskSchema: z.ZodType<CreateTaskInput> = z.object({
  title: z
    .string()
    .trim()
    .min(1, "O título é obrigatório.")
    .max(150, "O título deve ter no máximo 150 caracteres."),
  description: z
    .string()
    .trim()
    .max(5000, "A descrição deve ter no máximo 5000 caracteres.")
    .optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: dateSchema.optional(),
  assignedToId: optionalIdSchema.optional(),
  teamId: optionalIdSchema.optional(),
});

export const updateTaskSchema: z.ZodType<UpdateTaskInput> = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "O título não pode ficar vazio.")
      .max(150, "O título deve ter no máximo 150 caracteres.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(5000, "A descrição deve ter no máximo 5000 caracteres.")
      .nullable()
      .optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: dateSchema.nullable().optional(),
    assignedToId: nullableIdSchema.optional(),
    teamId: nullableIdSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Indique pelo menos um campo para atualizar.",
  });

export const taskFiltersSchema: z.ZodType<TaskFilters> = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assignedToId: optionalIdSchema.optional(),
  teamId: optionalIdSchema.optional(),
});

export const taskIdParamsSchema = z.object({
  taskId: optionalIdSchema,
});

export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>;
export type TaskFiltersQuery = z.infer<typeof taskFiltersSchema>;
