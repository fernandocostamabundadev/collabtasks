import {
  TaskNotFoundError,
  TaskRepositori,
} from "../repositories/task.repositori.js";
import type {
  CreateTaskInput,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types.js";

export class TaskServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TaskServiceError";
  }
}

export class TaskService {
  constructor(private readonly taskRepository: TaskRepositori) {}

  async createTask(createdById: string, data: CreateTaskInput): Promise<Task> {
    return this.taskRepository.createTask(createdById, data);
  }

  async getTaskById(taskId: string, userId: string): Promise<Task> {
    const task = await this.taskRepository.findTaskById(taskId, userId);

    if (!task) {
      throw new TaskServiceError("Tarefa não encontrada.", 404);
    }

    return task;
  }

  async getTasks(
    filters: TaskFilters = {},
    userId: string,
  ): Promise<Task[]> {
    return this.taskRepository.findTasks(filters, userId);
  }

  async updateTask(
    taskId: string,
    userId: string,
    data: UpdateTaskInput,
  ): Promise<Task> {
    try {
      return await this.taskRepository.updateTask(taskId, userId, data);
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw new TaskServiceError("Tarefa não encontrada.", 404);
      }

      throw error;
    }
  }

  async deleteTask(taskId: string, userId: string): Promise<Task> {
    try {
      return await this.taskRepository.deleteTask(taskId, userId);
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw new TaskServiceError("Tarefa não encontrada.", 404);
      }

      throw error;
    }
  }

}
