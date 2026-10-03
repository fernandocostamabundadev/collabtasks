import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import type {
  AuthResponse,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from "../types/auth.js";
import {
  AuthRepositorie,
  type AuthUserRecord,
} from "../repositories/auth.repositorie.js";

export interface AuthEmailSender {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

export interface AuthTokenIssuer {
  createAccessToken(user: AuthUser): Promise<string>;
}

export interface AuthServiceDependencies {
  emailSender: AuthEmailSender;
  tokenIssuer: AuthTokenIssuer;
}

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

const VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const PASSWORD_HASH_BYTES = 64;

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");

  return new Promise((resolve, reject) => {
    scrypt(password, salt, PASSWORD_HASH_BYTES, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash || !/^[a-f\d]+$/i.test(hash)) {
    return Promise.resolve(false);
  }

  const expectedHash = Buffer.from(hash, "hex");

  return new Promise((resolve, reject) => {
    scrypt(password, salt, expectedHash.length, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(
        expectedHash.length === derivedKey.length &&
          timingSafeEqual(expectedHash, derivedKey),
      );
    });
  });
}

function createRawToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username ?? undefined,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepositorie,
    private readonly dependencies: AuthServiceDependencies,
  ) {}

  async register(data: RegisterRequest): Promise<AuthUser> {
    const email = data.email.trim().toLowerCase();
    const existingUser = await this.authRepository.findUserByEmail(email);

    if (existingUser) {
      throw new AuthServiceError("Já existe uma conta com este e-mail.", 409);
    }

    const passwordHash = await hashPassword(data.password);
    const user = await this.authRepository.createUser({
      name: data.name.trim(),
      email,
      username: data.username?.trim(),
      passwordHash,
    });

    const token = createRawToken();
    await this.authRepository.createEmailVerificationToken({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS),
    });
    await this.dependencies.emailSender.sendVerificationEmail(user.email, token);

    return toAuthUser(user);
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const user = await this.authRepository.findUserByEmail(
      data.email.trim().toLowerCase(),
    );

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      throw new AuthServiceError("E-mail ou senha inválidos.", 401);
    }

    if (!user.emailVerified) {
      throw new AuthServiceError(
        "Confirme o seu e-mail antes de iniciar sessão.",
        403,
      );
    }

    const authUser = toAuthUser(user);
    const accessToken =
      await this.dependencies.tokenIssuer.createAccessToken(authUser);

    return { accessToken, user: authUser };
  }

  async verifyEmail(data: VerifyEmailRequest): Promise<void> {
    const tokenHash = hashToken(data.token.trim());
    const token =
      await this.authRepository.findEmailVerificationToken(tokenHash);

    if (!token) {
      throw new AuthServiceError(
        "Token de verificação inválido ou expirado.",
        400,
      );
    }

    await this.authRepository.markEmailAsVerified(token.userId);
    await this.authRepository.deleteEmailVerificationToken(tokenHash);
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    const user = await this.authRepository.findUserByEmail(
      data.email.trim().toLowerCase(),
    );

    if (!user) {
      return;
    }

    const token = createRawToken();
    await this.authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_LIFETIME_MS),
    });
    await this.dependencies.emailSender.sendPasswordResetEmail(
      user.email,
      token,
    );
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    const tokenHash = hashToken(data.token.trim());
    const token = await this.authRepository.findPasswordResetToken(tokenHash);

    if (!token) {
      throw new AuthServiceError(
        "Token de recuperação inválido ou expirado.",
        400,
      );
    }

    const passwordHash = await hashPassword(data.password);
    await this.authRepository.updatePassword(token.userId, passwordHash);
    await this.authRepository.deletePasswordResetToken(tokenHash);
  }
}
