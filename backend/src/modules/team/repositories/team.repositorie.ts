import { randomUUID } from "node:crypto";

import type {
  AddTeamMemberInput,
  CreateTeamInput,
  Team,
  TeamFilters,
  TeamMember,
  UpdateTeamInput,
} from "../types/team.types.js";

interface PrismaTeamModel {
  create(args: {
    data: {
      name: string;
      description: string | null;
      createdById: string;
    };
  }): Promise<Team>;
  findUnique(args: { where: { id: string } }): Promise<Team | null>;
  findMany(args: {
    where: {
      OR: Array<{ createdById: string } | { id: { in: string[] } }>;
      AND?: Array<{ id: { in: string[] } }>;
      name?: { contains: string; mode: "insensitive" };
    };
  }): Promise<Team[]>;
  update(args: {
    where: { id: string };
    data: UpdateTeamInput;
  }): Promise<Team>;
  delete(args: { where: { id: string } }): Promise<Team>;
}

interface PrismaTeamMemberModel {
  create(args: {
    data: {
      teamId: string;
      userId: string;
      role: TeamMember["role"];
    };
  }): Promise<TeamMember>;
  findFirst(args: {
    where: { teamId: string; userId: string };
  }): Promise<TeamMember | null>;
  findMany(args: {
    where: { teamId?: string; userId?: string };
  }): Promise<TeamMember[]>;
  deleteMany(args: {
    where: { teamId: string; userId: string };
  }): Promise<{ count: number }>;
}

export interface TeamPrismaClient {
  team: PrismaTeamModel;
  teamMember: PrismaTeamMemberModel;
}

export class TeamNotFoundError extends Error {
  constructor(teamId: string) {
    super(`Equipa não encontrada: ${teamId}`);
    this.name = "TeamNotFoundError";
  }
}

export class TeamMemberAlreadyExistsError extends Error {
  constructor() {
    super("Este utilizador já é membro da equipa.");
    this.name = "TeamMemberAlreadyExistsError";
  }
}

export class TeamMemberNotFoundError extends Error {
  constructor() {
    super("O utilizador não é membro desta equipa.");
    this.name = "TeamMemberNotFoundError";
  }
}

export class TeamOwnerCannotBeRemovedError extends Error {
  constructor() {
    super("O proprietário não pode ser removido da equipa.");
    this.name = "TeamOwnerCannotBeRemovedError";
  }
}

export class TeamRepositorie {
  private readonly teams: Team[] = [];
  private readonly members: TeamMember[] = [];

  constructor(private readonly prisma?: TeamPrismaClient) {}

  async createTeam(
    createdById: string,
    data: CreateTeamInput,
  ): Promise<Team> {
    const team = this.prisma
      ? await this.prisma.team.create({
          data: {
            name: data.name,
            description: data.description ?? null,
            createdById,
          },
        })
      : this.createTeamInMemory(createdById, data);

    await this.createMember(team.id, createdById, "owner");
    return team;
  }

  async findTeamById(teamId: string): Promise<Team | null> {
    if (this.prisma) {
      return this.prisma.team.findUnique({ where: { id: teamId } });
    }

    return this.teams.find((team) => team.id === teamId) ?? null;
  }

  async findTeams(
    filters: TeamFilters = {},
    userId: string,
  ): Promise<Team[]> {
    if (this.prisma) {
      const [userMemberships, filterMemberships] = await Promise.all([
        this.prisma.teamMember.findMany({ where: { userId } }),
        filters.memberId
          ? this.prisma.teamMember.findMany({
              where: { userId: filters.memberId },
            })
          : Promise.resolve(null),
      ]);

      const teamIds = userMemberships.map((member) => member.teamId);
      const where: Parameters<TeamPrismaClient["team"]["findMany"]>[0]["where"] =
        {
          OR: [{ createdById: userId }, { id: { in: teamIds } }],
        };

      if (filters.name) {
        where.name = { contains: filters.name, mode: "insensitive" };
      }

      if (filterMemberships) {
        where.AND = [
          { id: { in: filterMemberships.map((member) => member.teamId) } },
        ];
      }

      return this.prisma.team.findMany({ where });
    }

    const userTeamIds = new Set(
      this.members
        .filter((member) => member.userId === userId)
        .map((member) => member.teamId),
    );

    return this.teams.filter((team) => {
      const isAccessible = team.createdById === userId || userTeamIds.has(team.id);
      const matchesName =
        !filters.name ||
        team.name.toLowerCase().includes(filters.name.toLowerCase());
      const matchesMember =
        !filters.memberId ||
        this.members.some(
          (member) =>
            member.teamId === team.id && member.userId === filters.memberId,
        );

      return isAccessible && matchesName && matchesMember;
    });
  }

  async updateTeam(teamId: string, data: UpdateTeamInput): Promise<Team> {
    if (this.prisma) {
      return this.prisma.team.update({
        where: { id: teamId },
        data,
      });
    }

    const team = this.teams.find((record) => record.id === teamId);

    if (!team) {
      throw new TeamNotFoundError(teamId);
    }

    Object.assign(team, data, { updatedAt: new Date() });
    return team;
  }

  async deleteTeam(teamId: string): Promise<Team> {
    if (this.prisma) {
      return this.prisma.team.delete({ where: { id: teamId } });
    }

    const teamIndex = this.teams.findIndex((team) => team.id === teamId);

    if (teamIndex === -1) {
      throw new TeamNotFoundError(teamId);
    }

    const [deletedTeam] = this.teams.splice(teamIndex, 1);
    for (let index = this.members.length - 1; index >= 0; index -= 1) {
      if (this.members[index].teamId === teamId) {
        this.members.splice(index, 1);
      }
    }

    return deletedTeam;
  }

  async addMember(
    teamId: string,
    data: AddTeamMemberInput,
  ): Promise<TeamMember> {
    if (!(await this.findTeamById(teamId))) {
      throw new TeamNotFoundError(teamId);
    }

    if (await this.findMember(teamId, data.userId)) {
      throw new TeamMemberAlreadyExistsError();
    }

    return this.createMember(teamId, data.userId, data.role ?? "member");
  }

  async findMembers(teamId: string): Promise<TeamMember[]> {
    if (this.prisma) {
      return this.prisma.teamMember.findMany({ where: { teamId } });
    }

    return this.members.filter((member) => member.teamId === teamId);
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const member = await this.findMember(teamId, userId);

    if (!member) {
      throw new TeamMemberNotFoundError();
    }

    if (member.role === "owner") {
      throw new TeamOwnerCannotBeRemovedError();
    }

    if (this.prisma) {
      await this.prisma.teamMember.deleteMany({
        where: { teamId, userId },
      });
      return;
    }

    const memberIndex = this.members.findIndex(
      (record) => record.teamId === teamId && record.userId === userId,
    );
    this.members.splice(memberIndex, 1);
  }

  private async findMember(
    teamId: string,
    userId: string,
  ): Promise<TeamMember | null> {
    if (this.prisma) {
      return this.prisma.teamMember.findFirst({
        where: { teamId, userId },
      });
    }

    return (
      this.members.find(
        (member) => member.teamId === teamId && member.userId === userId,
      ) ?? null
    );
  }

  private async createMember(
    teamId: string,
    userId: string,
    role: TeamMember["role"],
  ): Promise<TeamMember> {
    if (this.prisma) {
      return this.prisma.teamMember.create({
        data: { teamId, userId, role },
      });
    }

    const member: TeamMember = {
      id: randomUUID(),
      teamId,
      userId,
      role,
      joinedAt: new Date(),
    };
    this.members.push(member);
    return member;
  }

  private createTeamInMemory(
    createdById: string,
    data: CreateTeamInput,
  ): Team {
    const now = new Date();
    const team: Team = {
      id: randomUUID(),
      name: data.name,
      description: data.description ?? null,
      createdById,
      createdAt: now,
      updatedAt: now,
    };

    this.teams.push(team);
    return team;
  }
}
