import dotenv from "dotenv";
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import express, {
  type Express,
  type RequestHandler,
  type Request,
  type Response,
} from "express";

import { AuthController } from "./modules/auth/controllers/auth.controller.js";
import { AuthRepositorie } from "./modules/auth/repositories/auth.repositorie.js";
import { createAuthRouter } from "./modules/auth/routes/auth.router.js";
import { AuthService } from "./modules/auth/services/auth.service.js";
import type { AuthUser } from "./modules/auth/types/auth.js";
import { TaskController } from "./modules/tasks/controllers/task.controller.js";
import { TaskRepositori } from "./modules/tasks/repositories/task.repositori.js";
import { createTaskRouter } from "./modules/tasks/routes/task.routes.js";
import { TaskService } from "./modules/tasks/services/task.service.js";
import { TeamController } from "./modules/team/controllers/team.controller.js";
import { TeamRepositorie } from "./modules/team/repositories/team.repositorie.js";
import { createTeamRouter } from "./modules/team/routes/team.route.js";
import { TeamService } from "./modules/team/services/team.service.js";

dotenv.config();

export const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function createDevelopmentAuthMiddleware(secret: string): RequestHandler {
  return (req, res, next) => {
    const authorization = req.get("authorization");
    const [scheme, token] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      res.status(401).json({ message: "Autenticação necessária." });
      return;
    }

    const [header, payload, signature, extra] = token.split(".");

    if (!header || !payload || !signature || extra !== undefined) {
      res.status(401).json({ message: "Token inválido." });
      return;
    }

    const unsignedToken = `${header}.${payload}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(unsignedToken)
      .digest();
    const providedSignature = Buffer.from(signature, "base64url");

    if (
      providedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(providedSignature, expectedSignature)
    ) {
      res.status(401).json({ message: "Token inválido." });
      return;
    }

    try {
      const decodedPayload: unknown = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      );

      if (
        typeof decodedPayload !== "object" ||
        decodedPayload === null ||
        !("sub" in decodedPayload) ||
        typeof decodedPayload.sub !== "string" ||
        !("exp" in decodedPayload) ||
        typeof decodedPayload.exp !== "number" ||
        decodedPayload.exp <= Math.floor(Date.now() / 1000)
      ) {
        res.status(401).json({ message: "Token inválido ou expirado." });
        return;
      }

      res.locals.user = { id: decodedPayload.sub };
      next();
    } catch {
      res.status(401).json({ message: "Token inválido." });
    }
  };
}

if (process.env.NODE_ENV === "production") {
  if (!process.env.AUTH_TOKEN_SECRET) {
    throw new Error("AUTH_TOKEN_SECRET é obrigatório em produção.");
  }
} else {
  const authRepository = new AuthRepositorie();
  const devTokenSecret =
    process.env.AUTH_TOKEN_SECRET ?? randomBytes(32).toString("hex");
  const authService = new AuthService(authRepository, {
    emailSender: {
      async sendVerificationEmail(email, token) {
        console.info(`[auth:dev] Token de verificação para ${email}: ${token}`);
      },
      async sendPasswordResetEmail(email, token) {
        console.info(`[auth:dev] Token de redefinição para ${email}: ${token}`);
      },
    },
    tokenIssuer: {
      async createAccessToken(user: AuthUser) {
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(
          JSON.stringify({ alg: "HS256", typ: "JWT" }),
        ).toString("base64url");
        const payload = Buffer.from(
          JSON.stringify({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            iat: now,
            exp: now + 60 * 60,
          }),
        ).toString("base64url");
        const unsignedToken = `${header}.${payload}`;
        const signature = createHmac("sha256", devTokenSecret)
          .update(unsignedToken)
          .digest("base64url");

        return `${unsignedToken}.${signature}`;
      },
    },
  });

  app.use(
    "/auth",
    createAuthRouter(new AuthController(authService)),
  );

  const taskRepository = new TaskRepositori();
  const taskService = new TaskService(taskRepository);
  const taskController = new TaskController(taskService);

  app.use(
    "/tasks",
    createDevelopmentAuthMiddleware(devTokenSecret),
    createTaskRouter(taskController),
  );

  const teamRepository = new TeamRepositorie();
  const teamService = new TeamService(teamRepository);
  const teamController = new TeamController(teamService);

  app.use(
    "/teams",
    createDevelopmentAuthMiddleware(devTokenSecret),
    createTeamRouter(teamController),
  );
}

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "collabtasks-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Bem-vindo à API collabtasks",
  });
});

export default app;
