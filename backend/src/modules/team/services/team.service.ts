import {
  TeamMemberAlreadyExistsError,
  TeamMemberNotFoundError,
  TeamNotFoundError,
  TeamOwnerCannotBeRemovedError,
  TeamRepositorie,
} from "../repositories/team.repositorie.js";
import type {
  AddTeamMemberInput,
  CreateTeamInput,
  Team,
  TeamFilters,
  TeamMember,
  UpdateTeamInput,
} from "../types/team.types.js";

export class TeamServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TeamServiceError";
  }
}

export class TeamService {
  constructor(private readonly teamRepository: TeamRepositorie) {}

  async createTeam(userId: string, data: CreateTeamInput): Promise<Team> {
    return this.teamRepository.createTeam(userId, data);
  }

  async getTeamById(teamId: string, userId: string): Promise<Team> {
    await this.ensureMember(teamId, userId);

    const team = await this.teamRepository.findTeamById(teamId);
    if (!team) {
      throw new TeamServiceError("Equipa não encontrada.", 404);
    }

    return team;
  }

  async getTeams(
    userId: string,
    filters: TeamFilters = {},
  ): Promise<Team[]> {
    return this.teamRepository.findTeams(filters, userId);
  }

  async updateTeam(
    teamId: string,
    userId: string,
    data: UpdateTeamInput,
  ): Promise<Team> {
    await this.ensureManager(teamId, userId);

    try {
      return await this.teamRepository.updateTeam(teamId, data);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async deleteTeam(teamId: string, userId: string): Promise<Team> {
    await this.ensureOwner(teamId, userId);

    try {
      return await this.teamRepository.deleteTeam(teamId);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async addMember(
    teamId: string,
    userId: string,
    data: AddTeamMemberInput,
  ): Promise<TeamMember> {
    await this.ensureManager(teamId, userId);

    try {
      return await this.teamRepository.addMember(teamId, data);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async getMembers(teamId: string, userId: string): Promise<TeamMember[]> {
    await this.ensureMember(teamId, userId);
    return this.teamRepository.findMembers(teamId);
  }

  async removeMember(
    teamId: string,
    userId: string,
    memberUserId: string,
  ): Promise<void> {
    const requester = await this.ensureManager(teamId, userId);
    const memberToRemove = (await this.teamRepository.findMembers(teamId)).find(
      (member) => member.userId === memberUserId,
    );

    if (!memberToRemove) {
      throw new TeamServiceError("O utilizador não é membro desta equipa.", 404);
    }

    if (memberToRemove.role === "owner") {
      throw new TeamServiceError(
        "O proprietário não pode ser removido da equipa.",
        400,
      );
    }

    if (requester.role === "admin" && memberToRemove.role === "admin") {
      throw new TeamServiceError(
        "Apenas o proprietário pode remover outro administrador.",
        403,
      );
    }

    try {
      await this.teamRepository.removeMember(teamId, memberUserId);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  private async ensureMember(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    const team = await this.teamRepository.findTeamById(teamId);
    if (!team) {
      throw new TeamServiceError("Equipa não encontrada.", 404);
    }

    const member = (await this.teamRepository.findMembers(teamId)).find(
      (record) => record.userId === userId,
    );

    if (!member) {
      throw new TeamServiceError("Não tens acesso a esta equipa.", 403);
    }

    return member;
  }

  private async ensureManager(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    const member = await this.ensureMember(teamId, userId);

    if (member.role !== "owner" && member.role !== "admin") {
      throw new TeamServiceError(
        "Apenas o proprietário ou um administrador pode gerir esta equipa.",
        403,
      );
    }

    return member;
  }

  private async ensureOwner(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    const member = await this.ensureMember(teamId, userId);

    if (member.role !== "owner") {
      throw new TeamServiceError(
        "Apenas o proprietário pode eliminar a equipa.",
        403,
      );
    }

    return member;
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof TeamNotFoundError) {
      throw new TeamServiceError("Equipa não encontrada.", 404);
    }

    if (error instanceof TeamMemberNotFoundError) {
      throw new TeamServiceError("O utilizador não é membro desta equipa.", 404);
    }

    if (error instanceof TeamMemberAlreadyExistsError) {
      throw new TeamServiceError(
        "Este utilizador já é membro da equipa.",
        409,
      );
    }

    if (error instanceof TeamOwnerCannotBeRemovedError) {
      throw new TeamServiceError(
        "O proprietário não pode ser removido da equipa.",
        400,
      );
    }

    throw error;
  }
}
