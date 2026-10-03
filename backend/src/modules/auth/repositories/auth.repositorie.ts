import { randomUUID } from "node:crypto";

import type { UserRole } from "../types/auth.js";

export interface AuthUserRecord {
  id: string;
  name: string;
  email: string;
  username: string | null;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Date;
}

export interface CreateAuthUserData {
  name: string;
  email: string;
  username?: string;
  passwordHash: string;
}

export interface AuthTokenRecord {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

interface PrismaUserModel {
  create(args: {
    data: {
      name: string;
      email: string;
      username: string | null;
      passwordHash: string;
    };
  }): Promise<AuthUserRecord>;
  findUnique(args: {
    where: { email: string } | { id: string };
  }): Promise<AuthUserRecord | null>;
  update(args: {
    where: { id: string };
    data: { emailVerified?: boolean; passwordHash?: string };
  }): Promise<AuthUserRecord>;
}

interface PrismaTokenModel {
  create(args: { data: AuthTokenRecord }): Promise<AuthTokenRecord>;
  findFirst(args: {
    where: { tokenHash: string; expiresAt: { gt: Date } };
  }): Promise<AuthTokenRecord | null>;
  deleteMany(args: { where: { tokenHash: string } }): Promise<{ count: number }>;
}

export interface AuthPrismaClient {
  user: PrismaUserModel;
  emailVerificationToken: PrismaTokenModel;
  passwordResetToken: PrismaTokenModel;
}

export class AuthRepositorie {
  private readonly users: AuthUserRecord[] = [];
  private readonly emailVerificationTokens: AuthTokenRecord[] = [];
  private readonly passwordResetTokens: AuthTokenRecord[] = [];

  constructor(private readonly prisma?: AuthPrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    if (!this.prisma) {
      return this.users.find((user) => user.email === email) ?? null;
    }

    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    if (!this.prisma) {
      return this.users.find((user) => user.id === userId) ?? null;
    }

    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async createUser(data: CreateAuthUserData): Promise<AuthUserRecord> {
    if (!this.prisma) {
      if (this.users.some((user) => user.email === data.email)) {
        throw new Error("Já existe uma conta com este e-mail.");
      }

      const user: AuthUserRecord = {
        id: randomUUID(),
        name: data.name,
        email: data.email,
        username: data.username ?? null,
        passwordHash: data.passwordHash,
        role: "user",
        emailVerified: false,
        createdAt: new Date(),
      };

      this.users.push(user);
      return user;
    }

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        username: data.username ?? null,
        passwordHash: data.passwordHash,
      },
    });
  }

  async createEmailVerificationToken(token: AuthTokenRecord): Promise<void> {
    if (!this.prisma) {
      this.emailVerificationTokens.push(token);
      return;
    }

    await this.prisma.emailVerificationToken.create({
      data: token,
    });
  }

  async findEmailVerificationToken(
    tokenHash: string,
  ): Promise<AuthTokenRecord | null> {
    if (!this.prisma) {
      return (
        this.emailVerificationTokens.find(
          (token) =>
            token.tokenHash === tokenHash && token.expiresAt > new Date(),
        ) ?? null
      );
    }

    return this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async markEmailAsVerified(userId: string): Promise<void> {
    if (!this.prisma) {
      const user = this.users.find((record) => record.id === userId);

      if (!user) {
        throw new Error(`Utilizador não encontrado: ${userId}`);
      }

      user.emailVerified = true;
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async deleteEmailVerificationToken(tokenHash: string): Promise<void> {
    if (!this.prisma) {
      const tokenIndex = this.emailVerificationTokens.findIndex(
        (token) => token.tokenHash === tokenHash,
      );

      if (tokenIndex !== -1) {
        this.emailVerificationTokens.splice(tokenIndex, 1);
      }
      return;
    }

    await this.prisma.emailVerificationToken.deleteMany({
      where: { tokenHash },
    });
  }

  async createPasswordResetToken(token: AuthTokenRecord): Promise<void> {
    if (!this.prisma) {
      this.passwordResetTokens.push(token);
      return;
    }

    await this.prisma.passwordResetToken.create({
      data: token,
    });
  }

  async findPasswordResetToken(
    tokenHash: string,
  ): Promise<AuthTokenRecord | null> {
    if (!this.prisma) {
      return (
        this.passwordResetTokens.find(
          (token) =>
            token.tokenHash === tokenHash && token.expiresAt > new Date(),
        ) ?? null
      );
    }

    return this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    if (!this.prisma) {
      const user = this.users.find((record) => record.id === userId);

      if (!user) {
        throw new Error(`Utilizador não encontrado: ${userId}`);
      }

      user.passwordHash = passwordHash;
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async deletePasswordResetToken(tokenHash: string): Promise<void> {
    if (!this.prisma) {
      const tokenIndex = this.passwordResetTokens.findIndex(
        (token) => token.tokenHash === tokenHash,
      );

      if (tokenIndex !== -1) {
        this.passwordResetTokens.splice(tokenIndex, 1);
      }
      return;
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { tokenHash },
    });
  }
}
