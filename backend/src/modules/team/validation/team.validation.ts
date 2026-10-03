import { z } from "zod";

import type {
  AddTeamMemberInput,
  CreateTeamInput,
  TeamFilters,
  UpdateTeamInput,
} from "../types/team.types.js";

const idSchema = z.string().trim().min(1, "O identificador é obrigatório.");

export const createTeamSchema: z.ZodType<CreateTeamInput> = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome da equipa é obrigatório.")
    .max(100, "O nome da equipa deve ter no máximo 100 caracteres."),
  description: z
    .string()
    .trim()
    .max(1000, "A descrição deve ter no máximo 1000 caracteres.")
    .optional(),
});

export const updateTeamSchema: z.ZodType<UpdateTeamInput> = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "O nome da equipa não pode ficar vazio.")
      .max(100, "O nome da equipa deve ter no máximo 100 caracteres.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "A descrição deve ter no máximo 1000 caracteres.")
      .nullable()
      .optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Indique pelo menos um campo para atualizar.",
  });

export const addTeamMemberSchema: z.ZodType<AddTeamMemberInput> = z.object({
  userId: idSchema,
  role: z.enum(["admin", "member"]).optional(),
});

export const teamFiltersSchema: z.ZodType<TeamFilters> = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  memberId: idSchema.optional(),
});

export const teamIdParamsSchema = z.object({
  teamId: idSchema,
});

export const teamMemberParamsSchema = z.object({
  teamId: idSchema,
  memberUserId: idSchema,
});

export type CreateTeamBody = z.infer<typeof createTeamSchema>;
export type UpdateTeamBody = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberBody = z.infer<typeof addTeamMemberSchema>;
export type TeamFiltersQuery = z.infer<typeof teamFiltersSchema>;
