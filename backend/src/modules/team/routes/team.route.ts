import { Router } from "express";

import type { TeamController } from "../controllers/team.controller.js";

export function createTeamRouter(teamController: TeamController): Router {
  const router = Router();

  router.post("/", teamController.createTeam);
  router.get("/", teamController.getTeams);
  router.get("/:teamId", teamController.getTeamById);
  router.patch("/:teamId", teamController.updateTeam);
  router.delete("/:teamId", teamController.deleteTeam);
  router.get("/:teamId/members", teamController.getMembers);
  router.post("/:teamId/members", teamController.addMember);
  router.delete(
    "/:teamId/members/:memberUserId",
    teamController.removeMember,
  );

  return router;
}
