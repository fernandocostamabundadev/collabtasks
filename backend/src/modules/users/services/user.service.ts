import {
  UserAlreadyExistsError,
  UserNotFoundError,
  UserRepositorie,
} from "../repositories/user.repositorie.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserFilters,
} from "../types/user.types.js";

export class UserServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

export class UserService {
  constructor(private readonly userRepository: UserRepositorie) {}

  async createUser(
    data: CreateUserInput,
    passwordHash: string,
  ): Promise<User> {
    try {
      return await this.userRepository.createUser(
        {
          ...data,
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          username: data.username?.trim(),
        },
        passwordHash,
      );
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      throw new UserServiceError("Utilizador não encontrado.", 404);
    }

    return user;
  }

  async getUsers(filters: UserFilters = {}): Promise<User[]> {
    return this.userRepository.findUsers(filters);
  }

  async updateUser(userId: string, data: UpdateUserInput): Promise<User> {
    await this.getUserById(userId);

    try {
      return await this.userRepository.updateUser(userId, {
        ...data,
        ...(data.name === undefined ? {} : { name: data.name.trim() }),
        ...(data.email === undefined
          ? {}
          : { email: data.email.trim().toLowerCase() }),
        ...(data.username === undefined || data.username === null
          ? {}
          : { username: data.username.trim() }),
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async deleteUser(userId: string): Promise<User> {
    await this.getUserById(userId);

    try {
      return await this.userRepository.deleteUser(userId);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof UserNotFoundError) {
      throw new UserServiceError("Utilizador não encontrado.", 404);
    }

    if (error instanceof UserAlreadyExistsError) {
      throw new UserServiceError(error.message, 409);
    }

    throw error;
  }
}
