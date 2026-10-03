import { randomUUID } from "node:crypto";

import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserFilters,
  UserRecord,
} from "../types/user.types.js";

interface PrismaUserModel {
  create(args: {
    data: {
      name: string;
      email: string;
      username: string | null;
      passwordHash: string;
      role: UserRecord["role"];
    };
  }): Promise<UserRecord>;
  findUnique(args: {
    where: { id: string } | { email: string };
  }): Promise<UserRecord | null>;
  findMany(args: {
    where: {
      name?: { contains: string; mode: "insensitive" };
      email?: { contains: string; mode: "insensitive" };
      role?: UserFilters["role"];
      emailVerified?: boolean;
    };
  }): Promise<UserRecord[]>;
  update(args: {
    where: { id: string };
    data: UpdateUserInput;
  }): Promise<UserRecord>;
  delete(args: { where: { id: string } }): Promise<UserRecord>;
}

export interface UserPrismaClient {
  user: PrismaUserModel;
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`Utilizador não encontrado: ${userId}`);
    this.name = "UserNotFoundError";
  }
}

export class UserAlreadyExistsError extends Error {
  constructor(field: "email" | "username") {
    super(`Já existe um utilizador com este ${field === "email" ? "e-mail" : "username"}.`);
    this.name = "UserAlreadyExistsError";
  }
}

function toPublicUser(user: UserRecord): User {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export class UserRepositorie {
  private readonly users: UserRecord[] = [];

  constructor(private readonly prisma?: UserPrismaClient) {}

  async createUser(
    data: CreateUserInput,
    passwordHash: string,
  ): Promise<User> {
    if (this.prisma) {
      const user = await this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          username: data.username ?? null,
          passwordHash,
          role: data.role ?? "user",
        },
      });

      return toPublicUser(user);
    }

    if (this.users.some((user) => user.email === data.email)) {
      throw new UserAlreadyExistsError("email");
    }

    if (
      data.username &&
      this.users.some((user) => user.username === data.username)
    ) {
      throw new UserAlreadyExistsError("username");
    }

    const user: UserRecord = {
      id: randomUUID(),
      name: data.name,
      email: data.email,
      username: data.username ?? null,
      passwordHash,
      role: data.role ?? "user",
      emailVerified: false,
      createdAt: new Date(),
    };

    this.users.push(user);
    return toPublicUser(user);
  }

  async findUserById(userId: string): Promise<User | null> {
    const user = this.prisma
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : (this.users.find((record) => record.id === userId) ?? null);

    return user ? toPublicUser(user) : null;
  }

  async findUserRecordById(userId: string): Promise<UserRecord | null> {
    if (this.prisma) {
      return this.prisma.user.findUnique({ where: { id: userId } });
    }

    return this.users.find((user) => user.id === userId) ?? null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const user = this.prisma
      ? await this.prisma.user.findUnique({ where: { email } })
      : (this.users.find((record) => record.email === email) ?? null);

    return user ? toPublicUser(user) : null;
  }

  async findUsers(filters: UserFilters = {}): Promise<User[]> {
    const users = this.prisma
      ? await this.prisma.user.findMany({
          where: {
            ...(filters.name
              ? { name: { contains: filters.name, mode: "insensitive" as const } }
              : {}),
            ...(filters.email
              ? { email: { contains: filters.email, mode: "insensitive" as const } }
              : {}),
            ...(filters.role === undefined ? {} : { role: filters.role }),
            ...(filters.emailVerified === undefined
              ? {}
              : { emailVerified: filters.emailVerified }),
          },
        })
      : this.users.filter((user) => {
          const matchesName =
            !filters.name ||
            user.name.toLowerCase().includes(filters.name.toLowerCase());
          const matchesEmail =
            !filters.email ||
            user.email.toLowerCase().includes(filters.email.toLowerCase());
          const matchesRole =
            filters.role === undefined || user.role === filters.role;
          const matchesVerification =
            filters.emailVerified === undefined ||
            user.emailVerified === filters.emailVerified;

          return (
            matchesName && matchesEmail && matchesRole && matchesVerification
          );
        });

    return users.map(toPublicUser);
  }

  async updateUser(userId: string, data: UpdateUserInput): Promise<User> {
    if (this.prisma) {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
      });

      return toPublicUser(user);
    }

    const user = this.users.find((record) => record.id === userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    if (
      data.email &&
      this.users.some(
        (record) => record.id !== userId && record.email === data.email,
      )
    ) {
      throw new UserAlreadyExistsError("email");
    }

    if (
      data.username &&
      this.users.some(
        (record) => record.id !== userId && record.username === data.username,
      )
    ) {
      throw new UserAlreadyExistsError("username");
    }

    Object.assign(user, data);
    return toPublicUser(user);
  }

  async deleteUser(userId: string): Promise<User> {
    if (this.prisma) {
      const user = await this.prisma.user.delete({
        where: { id: userId },
      });

      return toPublicUser(user);
    }

    const userIndex = this.users.findIndex((record) => record.id === userId);
    if (userIndex === -1) {
      throw new UserNotFoundError(userId);
    }

    const [deletedUser] = this.users.splice(userIndex, 1);
    return toPublicUser(deletedUser);
  }
}
