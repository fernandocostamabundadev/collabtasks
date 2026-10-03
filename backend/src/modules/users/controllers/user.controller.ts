import type { RequestHandler, Response } from "express";

import { UserService, UserServiceError } from "../services/user.service.js";
import {
  updateUserSchema,
  userFiltersSchema,
  userIdParamsSchema,
} from "../validation/user.validation.js";

interface AuthenticatedUser {
  id: string;
  role?: string;
}

function getAuthenticatedUser(locals: unknown): AuthenticatedUser | undefined {
  if (typeof locals !== "object" || locals === null || !("user" in locals)) {
    return undefined;
  }

  const user = locals.user;
  if (
    typeof user !== "object" ||
    user === null ||
    !("id" in user) ||
    typeof user.id !== "string" ||
    user.id.trim().length === 0
  ) {
    return undefined;
  }

  return {
    id: user.id,
    role:
      "role" in user && typeof user.role === "string"
        ? user.role
        : undefined,
  };
}

export class UserController {
  constructor(private readonly userService: UserService) {}

  readonly getUsers: RequestHandler = (req, res, next) => {
    if (!this.requireAdmin(res)) return;

    const result = userFiltersSchema.safeParse(req.query);
    if (!result.success) {
      this.sendValidationError(res, result.error);
      return;
    }

    void this.runRequest(res, next, async () => {
      const users = await this.userService.getUsers(result.data);
      res.status(200).json({ data: users });
    });
  };

  readonly getUserById: RequestHandler = (req, res, next) => {
    const requester = this.requireUser(res);
    if (!requester) return;

    const params = userIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      this.sendValidationError(res, params.error);
      return;
    }

    if (!this.isAdmin(requester) && requester.id !== params.data.userId) {
      res.status(403).json({ message: "Não tens acesso a este utilizador." });
      return;
    }

    void this.runRequest(res, next, async () => {
      const user = await this.userService.getUserById(params.data.userId);
      res.status(200).json({ data: user });
    });
  };

  readonly updateUser: RequestHandler = (req, res, next) => {
    const requester = this.requireUser(res);
    if (!requester) return;

    const params = userIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      this.sendValidationError(res, params.error);
      return;
    }

    if (!this.isAdmin(requester) && requester.id !== params.data.userId) {
      res.status(403).json({ message: "Não tens acesso a este utilizador." });
      return;
    }

    const body = updateUserSchema.safeParse(req.body);
    if (!body.success) {
      this.sendValidationError(res, body.error);
      return;
    }

    if (!this.isAdmin(requester) && body.data.role !== undefined) {
      res.status(403).json({ message: "Não podes alterar o teu próprio role." });
      return;
    }

    void this.runRequest(res, next, async () => {
      const user = await this.userService.updateUser(
        params.data.userId,
        body.data,
      );
      res.status(200).json({
        message: "Utilizador atualizado com sucesso.",
        data: user,
      });
    });
  };

  readonly deleteUser: RequestHandler = (req, res, next) => {
    const requester = this.requireUser(res);
    if (!requester) return;

    const params = userIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      this.sendValidationError(res, params.error);
      return;
    }

    if (!this.isAdmin(requester) && requester.id !== params.data.userId) {
      res.status(403).json({ message: "Não tens acesso a este utilizador." });
      return;
    }

    void this.runRequest(res, next, async () => {
      await this.userService.deleteUser(params.data.userId);
      res.status(204).send();
    });
  };

  private requireUser(res: Response): AuthenticatedUser | undefined {
    const user = getAuthenticatedUser(res.locals);
    if (!user) {
      res.status(401).json({ message: "Autenticação necessária." });
      return undefined;
    }

    return user;
  }

  private requireAdmin(res: Response): AuthenticatedUser | undefined {
    const user = this.requireUser(res);
    if (!user) return undefined;

    if (!this.isAdmin(user)) {
      res.status(403).json({ message: "Apenas administradores podem realizar esta ação." });
      return undefined;
    }

    return user;
  }

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === "admin";
  }

  private async runRequest(
    res: Response,
    next: Parameters<RequestHandler>[2],
    action: () => Promise<void>,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      next(error);
    }
  }

  private sendValidationError(
    res: Response,
    error: { issues: Array<{ path: PropertyKey[]; message: string }> },
  ): void {
    res.status(400).json({
      message: "Dados inválidos.",
      errors: error.issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
  }
}
