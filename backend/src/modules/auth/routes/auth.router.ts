import { Router } from "express";

import type { AuthController } from "../controllers/auth.controller.js";

export function createAuthRouter(authController: AuthController): Router {
  const router = Router();

  router.post("/register", authController.register);
  router.post("/login", authController.login);
  router.post("/verify-email", authController.verifyEmail);
  router.post("/forgot-password", authController.forgotPassword);
  router.post("/reset-password", authController.resetPassword);

  return router;
}
