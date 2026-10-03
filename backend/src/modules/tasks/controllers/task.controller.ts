import type { Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

import { TaskService, TaskServiceError } from "../services/task.service.js";
import {
  createTaskSchema,
  taskFiltersSchema,
  taskIdParamsSchema,
  updateTaskSchema,
} from "../validation/task.validation.js";

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

export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  readonly createTask: RequestHandler = (req, res, next) => {
    const createdById = getAuthenticatedUserId(res.locals);

    if (!createdById?.trim()) {
      res.status(401).json({ message: "Autenticação necessária." });
      return;
    }

    return this.handleRequest(
      req,
      res,
      next,
      createTaskSchema,
      (body) => this.taskService.createTask(createdById.trim(), body),
      201,
      "Tarefa criada com sucesso.",
    );
  };

  readonly getTasks: RequestHandler = (req, res, next) => {
    const result = taskFiltersSchema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        message: "Filtros inválidos.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const userId = getAuthenticatedUserId(res.locals);

    if (!userId) {
      res.status(401).json({ message: "Autenticação necessária." });
      return;
    }

    void this.runRequest(res, next, async () => {
      const tasks = await this.taskService.getTasks(result.data, userId);
      res.status(200).json({ data: tasks });
    });
  };

  readonly getTaskById: RequestHandler = (req, res, next) => {
    const userId = getAuthenticatedUserId(res.locals);

    if (!userId) {
      res.status(401).json({ message: "Autenticação necessária." });
      return;
    }

    return this.handleRequest(
      req,
      res,
      next,
      taskIdParamsSchema,
      (params) => this.taskService.getTaskById(params.taskId, userId),
      200,
      "Tarefa obtida com sucesso.",
      "params",
    );
  };

  readonly updateTask: RequestHandler = (req, res, next) => {
    const userId = getAuthenticatedUserId(res.locals);

    if (!userId) {
      res.status(401).json({ message: "Autenticação necessária." });
      return;
    }

    const params = taskIdParamsSchema.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ message: "Identificador da tarefa inválido." });
      return;
    }

    return this.handleRequest(
      req,
      res,
      next,
      updateTaskSchema,
      (body) =>
        this.taskService.updateTask(params.data.taskId, userId, body),
      200,
      "Tarefa atualizada com sucesso.",
    );
  };

  readonly deleteTask: RequestHandler = (req, res, next) => {
    const userId = getAuthenticatedUserId(res.locals);

    if (!userId) {
      res.status(401).json({ message: "Autenticação necessária." });
      return;
    }

    const params = taskIdParamsSchema.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ message: "Identificador da tarefa inválido." });
      return;
    }

    void this.runRequest(res, next, async () => {
      await this.taskService.deleteTask(params.data.taskId, userId);
      res.status(204).send();
    });
  };

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
      res.status(400).json({
        message: "Dados inválidos.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
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
      if (error instanceof TaskServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      next(error);
    }
  }
}
