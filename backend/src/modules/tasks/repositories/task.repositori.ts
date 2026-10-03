import { randomUUID } from "node:crypto";

import type {
  CreateTaskInput,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types.js";

interface PrismaTaskModel {
  create(args: {
    data: {
      title: string;
      description: string | null;
      status: Task["status"];
      priority: Task["priority"];
      dueDate: Date | null;
      createdById: string;
      assignedToId: string | null;
      teamId: string | null;
    };
  }): Promise<Task>;
  findUnique(args: { where: { id: string } }): Promise<Task | null>;
  findMany(args: {
    where: Partial<TaskFilters> & {
      OR?: Array<
        | { createdById: string }
        | { teamId: { in: string[] } }
      >;
    };
  }): Promise<Task[]>;
  update(args: {
    where: { id: string };
    data: UpdateTaskInput;
  }): Promise<Task>;
  delete(args: { where: { id: string } }): Promise<Task>;
}

interface PrismaTeamMemberModel {
  findMany(args: {
    where: { userId: string };
    select: { teamId: true };
  }): Promise<Array<{ teamId: string }>>;
  findFirst(args: {
    where: { teamId: string; userId: string };
  }): Promise<{ teamId: string; userId: string } | null>;
}

export interface TaskPrismaClient {
  task: PrismaTaskModel;
  teamMember: PrismaTeamMemberModel;
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Tarefa não encontrada: ${taskId}`);
    this.name = "TaskNotFoundError";
  }
}

export class TaskRepositori {
  private readonly tasks: Task[] = [];
  private readonly teamMembers: Array<{ teamId: string; userId: string }> = [];

  constructor(private readonly prisma?: TaskPrismaClient) {}

  addTeamMember(teamId: string, userId: string): void {
    if (!this.teamMembers.some(
      (member) => member.teamId === teamId && member.userId === userId,
    )) {
      this.teamMembers.push({ teamId, userId });
    }
  }

  async createTask(
    createdById: string,
    data: CreateTaskInput,
  ): Promise<Task> {
    if (this.prisma) {
      return this.prisma.task.create({
        data: {
          title: data.title,
          description: data.description ?? null,
          status: "todo",
          priority: data.priority ?? "medium",
          dueDate: data.dueDate ?? null,
          createdById,
          assignedToId: data.assignedToId ?? null,
          teamId: data.teamId ?? null,
        },
      });
    }

    const now = new Date();
    const task: Task = {
      id: randomUUID(),
      title: data.title,
      description: data.description ?? null,
      status: "todo",
      priority: data.priority ?? "medium",
      dueDate: data.dueDate ?? null,
      createdById,
      assignedToId: data.assignedToId ?? null,
      teamId: data.teamId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.push(task);
    return task;
  }

  async findTaskById(taskId: string, userId: string): Promise<Task | null> {
    if (this.prisma) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task || !(await this.userCanAccessTask(task, userId))) {
        return null;
      }

      return task;
    }

    const task = this.tasks.find((record) => record.id === taskId);

    if (!task || !this.userCanAccessTaskInMemory(task, userId)) {
      return null;
    }

    return task;
  }

  async findTasks(
    filters: TaskFilters = {},
    userId: string,
  ): Promise<Task[]> {
    if (this.prisma) {
      const memberships = await this.prisma.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
      });
      const teamIds = memberships.map((membership) => membership.teamId);

      return this.prisma.task.findMany({
        where: {
          ...filters,
          OR: [
            { createdById: userId },
            ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
          ],
        },
      });
    }

    const teamIds = new Set(
      this.teamMembers
        .filter((member) => member.userId === userId)
        .map((member) => member.teamId),
    );

    return this.tasks.filter((task) => {
      const matchesFilters =
        (filters.status === undefined || task.status === filters.status) &&
        (filters.priority === undefined ||
          task.priority === filters.priority) &&
        (filters.assignedToId === undefined ||
          task.assignedToId === filters.assignedToId) &&
        (filters.teamId === undefined || task.teamId === filters.teamId);
      const canAccess =
        task.createdById === userId ||
        (task.teamId !== null && teamIds.has(task.teamId));

      return matchesFilters && canAccess;
    });
  }

  async updateTask(
    taskId: string,
    userId: string,
    data: UpdateTaskInput,
  ): Promise<Task> {
    const task = await this.findTaskById(taskId, userId);

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    if (this.prisma) {
      return this.prisma.task.update({
        where: { id: taskId },
        data,
      });
    }

    Object.assign(task, data, { updatedAt: new Date() });
    return task;
  }

  async deleteTask(taskId: string, userId: string): Promise<Task> {
    const task = await this.findTaskById(taskId, userId);

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    if (this.prisma) {
      return this.prisma.task.delete({
        where: { id: taskId },
      });
    }

    const taskIndex = this.tasks.findIndex((record) => record.id === task.id);

    if (taskIndex === -1) {
      throw new TaskNotFoundError(taskId);
    }

    const [deletedTask] = this.tasks.splice(taskIndex, 1);
    return deletedTask;
  }

  private async userCanAccessTask(task: Task, userId: string): Promise<boolean> {
    if (task.createdById === userId) {
      return true;
    }

    if (!task.teamId || !this.prisma) {
      return false;
    }

    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId: task.teamId, userId },
    });

    return membership !== null;
  }

  private userCanAccessTaskInMemory(task: Task, userId: string): boolean {
    return (
      task.createdById === userId ||
      (task.teamId !== null &&
        this.teamMembers.some(
          (member) =>
            member.teamId === task.teamId && member.userId === userId,
        ))
    );
  }
}
