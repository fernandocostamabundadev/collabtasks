import type { UserRole } from "../../auth/types/auth.js";

export interface User {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Date;
}

export interface UserRecord extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  username?: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  username?: string | null;
  role?: UserRole;
}

export interface UserFilters {
  name?: string;
  email?: string;
  role?: UserRole;
  emailVerified?: boolean;
}
