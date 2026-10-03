import type { Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

import { TeamService, TeamServiceError } from "../services/team.service.js";
import {
  addTeamMemberSchema,
  createTeamSchema,
  teamFiltersSchema,
  teamIdParamsSchema,
  teamMemberParamsSchema,
  updateTeamSchema,
} from "../validation/team.validation.js";

function getAuthenticatedUserId(locals: unknown): string | undefined {
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

  return user.id;
}

export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  readonly createTeam: RequestHandler = (req, res, next) => {
    const userId = this.requireUserId(res);
    if (!userId) return;

    return this.handleRequest(
      req,
      res,
      next,
      createTeamSchema,
      (body) => this.teamService.createTeam(userId, body),
      201,
      "Equipa criada com sucesso.",
    );
  };

  readonly getTeams: RequestHandler = (req, res, next) => {
    const userId = this.requireUserId(res);
    if (!userId) return;

    const result = teamFiltersSchema.safeParse(req.query);
    if (!result.success) {
      this.sendValidationError(res, result.error);
      return;
    }

    void this.runRequest(res, next, async () => {
      const teams = await this.teamService.getTeams(userId, result.data);
      res.status(200).json({ data: teams });
    });
  };

  readonly getTeamById: RequestHandler = (req, res, next) => {
    const userId = this.requireUserId(res);
    if (!userId) return;

    return this.handleRequest(
      req,
      res,
      next,
      teamIdParamsSchema,
      (params) => this.teamService.getTeamById(params.teamId, userId),
      200,
      "Equipa obtida com sucesso.",
      "params",
    );
  };

  readonly updateTeam: RequestHandler = (req, res, next) => {
    const userId = this.requireUserId(res);
    if (!userId) return;

    const params = teamIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      this.sendValidationError(res, params.error);
      return;
    }

    return this.handleRequest(
      req,
      res,
      next,
      updateTeamSchema,
      (body) =>
        this.teamService.updateTeam(params.data.teamId, userId, body),
      200,
      "Equipa atualizada com sucesso.",
    );
  };

  readonly deleteTeam: RequestHandler = (req, res, next) => {
    const userId = this.requireUserId(res);
    if (!userId) return;

    const params = teamIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      this.sendValidationError(res, params.error);
      return;
    }

    void this.runRequest(res, next, async () => {
      await this.teamService.deleteTeam(params.data.teamId, userId);
      res.status(204).send();
    });
  };

  readonly getMembers: RequestHandler = (req, res, next) => {
    const userId = this.requireUserId(res);
    if (!userId) return;

    const params = teamIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      this.sendValidationError(res, params.error);
      return;
    }

    void this.runRequest(res, next, async () => {
      const members = await this.teamService.getMembers(
        params.data.teamId,
        userId,
      );
      res.status(200).json({ data: members });
    });
  };

  readonly addMember: RequestHandler = (req, res, next) => {
    const userId = this.requireUserId(res);
    if (!userId) return;

    const params = teamIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      this.sendValidationError(res, params.error);
      return;
    }

    return this.handleRequest(
      req,
      res,
      next,
      addTeamMemberSchema,
      (body) =>
        this.teamService.addMember(params.data.teamId, userId, body),
      201,
      "Membro adicionado à equipa.",
    );
  };

  readonly removeMember: RequestHandler = (req, res, next) => {
    const userId = this.requireUserId(res);
    if (!userId) return;

    const params = teamMemberParamsSchema.safeParse(req.params);

    if (!params.success) {
      this.sendValidationError(res, params.error);
      return;
    }

    void this.runRequest(res, next, async () => {
      await this.teamService.removeMember(
        params.data.teamId,
        userId,
        params.data.memberUserId,
      );
      res.status(204).send();
    });
  };

  private requireUserId(res: Response): string | undefined {
    const userId = getAuthenticatedUserId(res.locals);
    if (!userId) {
      res.status(401).json({ message: "Autenticação necessária." });
      return undefined;
    }

    return userId;
  }

  private async handleRequest<T>(
    req: Request,
    res: Response,
    next: Parameters<RequestHandler>[2],
    schema: ZodType<T>,
    action: (body: T) => Promise<unknown>,
    successStatus: number,
    successMessage: string,
    source: "body" | "params" = "body",
  ): Promise<void> {
    const result = schema.safeParse(source === "params" ? req.params : req.body);

    if (!result.success) {
      this.sendValidationError(res, result.error);
      return;
    }

    await this.runRequest(res, next, async () => {
      const data = await action(result.data);
      res.status(successStatus).json({
        message: successMessage,
        ...(data === undefined ? {} : { data }),
      });
    });
  }

  private async runRequest(
    res: Response,
    next: Parameters<RequestHandler>[2],
    action: () => Promise<void>,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      if (error instanceof TeamServiceError) {
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
