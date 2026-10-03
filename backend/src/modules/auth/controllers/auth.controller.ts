import type { Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../validation/auth.validation.js";
import {
  AuthService,
  AuthServiceError,
} from "../services/auth.service.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  readonly register: RequestHandler = (req, res, next) =>
    this.handleRequest(
      req,
      res,
      next,
      registerSchema,
      (body) => this.authService.register(body),
      201,
      "Conta criada. Verifique o seu e-mail para ativá-la.",
    );

  readonly login: RequestHandler = (req, res, next) =>
    this.handleRequest(
      req,
      res,
      next,
      loginSchema,
      (body) => this.authService.login(body),
      200,
      "Sessão iniciada.",
    );

  readonly verifyEmail: RequestHandler = (req, res, next) =>
    this.handleRequest(
      req,
      res,
      next,
      verifyEmailSchema,
      (body) => this.authService.verifyEmail(body),
      200,
      "E-mail verificado com sucesso.",
    );

  readonly forgotPassword: RequestHandler = (req, res, next) =>
    this.handleRequest(
      req,
      res,
      next,
      forgotPasswordSchema,
      (body) => this.authService.forgotPassword(body),
      202,
      "Se a conta existir, receberá instruções para redefinir a senha.",
    );

  readonly resetPassword: RequestHandler = (req, res, next) =>
    this.handleRequest(
      req,
      res,
      next,
      resetPasswordSchema,
      (body) => this.authService.resetPassword(body),
      200,
      "Senha redefinida com sucesso.",
    );

  private async handleRequest<T>(
    req: Request,
    res: Response,
    next: Parameters<RequestHandler>[2],
    schema: ZodType<T>,
    action: (body: T) => Promise<unknown>,
    successStatus: number,
    successMessage: string,
  ): Promise<void> {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Dados inválidos.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    try {
      const data = await action(result.data);
      res.status(successStatus).json({
        message: successMessage,
        ...(data === undefined ? {} : { data }),
      });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      next(error);
    }
  }
}
