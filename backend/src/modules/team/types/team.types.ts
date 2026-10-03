export type TeamRole = "owner" | "admin" | "member";

export interface Team {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date;
}

export interface CreateTeamInput {
  name: string;
  description?: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string | null;
}

export interface AddTeamMemberInput {
  userId: string;
  role?: Exclude<TeamRole, "owner">;
}

export interface TeamFilters {
  name?: string;
  memberId?: string;
}
