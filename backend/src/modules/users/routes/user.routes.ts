import { Router } from "express";

import type { UserController } from "../controllers/user.controller.js";

export function createUserRouter(userController: UserController): Router {
  const router = Router();

  router.get("/", userController.getUsers);
  router.get("/:userId", userController.getUserById);
  router.patch("/:userId", userController.updateUser);
  router.delete("/:userId", userController.deleteUser);

  return router;
}
