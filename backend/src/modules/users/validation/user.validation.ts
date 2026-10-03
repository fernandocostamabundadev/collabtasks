import { z } from "zod";

import type {
  CreateUserInput,
  UpdateUserInput,
  UserFilters,
} from "../types/user.types.js";

const idSchema = z.string().trim().min(1, "O identificador é obrigatório.");

const emailSchema = z
  .string()
  .trim()
  .min(1, "O e-mail é obrigatório.")
  .toLowerCase()
  .email("Informe um e-mail válido.");

const userRoleSchema = z.enum(["admin", "user"]);

export const createUserSchema: z.ZodType<CreateUserInput> = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(100, "O nome deve ter no máximo 100 caracteres."),
  email: emailSchema,
  username: z
    .string()
    .trim()
    .min(3, "O username deve ter pelo menos 3 caracteres.")
    .max(30, "O username deve ter no máximo 30 caracteres.")
    .optional(),
  role: userRoleSchema.optional(),
});

export const updateUserSchema: z.ZodType<UpdateUserInput> = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(100, "O nome deve ter no máximo 100 caracteres.")
      .optional(),
    email: emailSchema.optional(),
    username: z
      .string()
      .trim()
      .min(3, "O username deve ter pelo menos 3 caracteres.")
      .max(30, "O username deve ter no máximo 30 caracteres.")
      .nullable()
      .optional(),
    role: userRoleSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Indique pelo menos um campo para atualizar.",
  });

export const userFiltersSchema: z.ZodType<UserFilters> = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: emailSchema.optional(),
  role: userRoleSchema.optional(),
  emailVerified: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const userIdParamsSchema = z.object({
  userId: idSchema,
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type UserFiltersQuery = z.infer<typeof userFiltersSchema>;
