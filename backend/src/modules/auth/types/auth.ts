export type UserRole = "admin" | "user";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  name: string;
  username?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username?: string;
  role?: UserRole;
  createdAt?: Date;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name?: string;
  role?: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}
