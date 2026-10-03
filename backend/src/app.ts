import dotenv from "dotenv";
import { createHmac, randomBytes } from "node:crypto";
import express, {
  type Express,
  type Request,
  type Response,
} from "express";

import { AuthController } from "./modules/auth/controllers/auth.controller.js";
import { AuthRepositorie } from "./modules/auth/repositories/auth.repositorie.js";
import { createAuthRouter } from "./modules/auth/routes/auth.router.js";
import { AuthService } from "./modules/auth/services/auth.service.js";
import type { AuthUser } from "./modules/auth/types/auth.js";

dotenv.config();

export const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
