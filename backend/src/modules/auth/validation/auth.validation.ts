import { z } from "zod";

import type {
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from "../types/auth.js";

const emailSchema = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório.")
  .toLowerCase()
  .email("Informe um e-mail válido.");

const passwordSchema = z
  .string()
  .min(1, "Senha é obrigatória.")
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
    "A senha deve conter letras maiúsculas, minúsculas e números.",
  );

const tokenSchema = z.string().trim().min(1, "Token inválido.");

export const loginSchema: z.ZodType<LoginRequest> = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha é obrigatória.").min(8, "A senha deve ter pelo menos 8 caracteres."),
});

export const registerSchema: z.ZodType<RegisterRequest> = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório.")
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(100, "O nome deve ter no máximo 100 caracteres."),
  email: emailSchema,
  password: passwordSchema,
  username: z
    .string()
    .trim()
    .min(3, "O username deve ter pelo menos 3 caracteres.")
    .max(30, "O username deve ter no máximo 30 caracteres.")
    .optional(),
});

export const verifyEmailSchema: z.ZodType<VerifyEmailRequest> = z.object({
  token: tokenSchema,
});

export const forgotPasswordSchema: z.ZodType<ForgotPasswordRequest> = z.object({
  email: emailSchema,
});

export const resetPasswordSchema: z.ZodType<ResetPasswordRequest> = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
