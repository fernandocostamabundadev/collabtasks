import { Router } from "express";

import type { TaskController } from "../controllers/task.controller.js";

export function createTaskRouter(taskController: TaskController): Router {
  const router = Router();

  router.post("/", taskController.createTask);
  router.get("/", taskController.getTasks);
  router.get("/:taskId", taskController.getTaskById);
  router.patch("/:taskId", taskController.updateTask);
  router.delete("/:taskId", taskController.deleteTask);

  return router;
}
