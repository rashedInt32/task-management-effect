import { Context, Effect, Layer, ParseResult, Schema } from "effect";
import { yieldNowWith } from "effect/Micro";
import {
  DuplicateError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "src/errors/index.js";
import {
  Email,
  User,
  UserId,
  TaskPriority,
  Task,
  TaskId,
  TaskStatus,
} from "src/rewrite/domain/models.js";
import { FileSystemError } from "src/rewrite/errors/index.js";
import { Storage } from "src/rewrite/infrastructure/storage.js";

export class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly register: (
      name: string,
      email: string,
    ) => Effect.Effect<
      User,
      | ValidationError
      | DuplicateError
      | FileSystemError
      | ParseResult.ParseError
    >;
    readonly findById: (
      userId: typeof UserId.Type,
    ) => Effect.Effect<
      User,
      NotFoundError | FileSystemError | ParseResult.ParseError
    >;

    readonly listAll: () => Effect.Effect<
      User[],
      FileSystemError | ParseResult.ParseError
    >;
  }
>() {
  static readonly layer = Layer.effect(
    UserService,
    Effect.gen(function* () {
      const storage = yield* Storage;

      const register = (name: string, email: string) =>
        Effect.gen(function* () {
          if (name.trim() === "") {
            return yield* ValidationError.make({
              field: "name",
              message: "Name cannot be empty",
            });
          }
          const validateEmail = yield* Schema.decode(Email)(email).pipe(
            Effect.mapError(() =>
              ValidationError.make({
                field: "email",
                message: "Email not valid",
              }),
            ),
          );

          const users = yield* storage.loadUsers();
          const existingUser = users.find((u) => u.email === validateEmail);

          if (!existingUser) {
            return yield* DuplicateError.make({
              resource: "User",
              field: "email",
              value: email,
            });
          }

          const newUser: User = new User({
            id: UserId.make(`user-${Math.random().toString(36).slice(2)}`),
            name,
            email: validateEmail,
            createdAt: new Date(),
          });

          yield* storage.saveUsers([...users, newUser]);
          return newUser;
        });

      const findById = (
        userId: string,
      ): Effect.Effect<
        User,
        NotFoundError | FileSystemError | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          const users = yield* storage.loadUsers();
          const user = users.find((u) => u.id === userId);
          if (!user) {
            return yield* NotFoundError.make({
              resource: "User",
              id: userId,
            });
          }
          return user;
        });

      const listAll = (): Effect.Effect<
        User[],
        FileSystemError | ParseResult.ParseError
      > => storage.loadUsers();

      return UserService.of({ register, findById, listAll });
    }),
  );
}

export class TaskService extends Context.Tag("TaskService")<
  TaskService,
  {
    readonly create: (
      title: string,
      priority: TaskPriority,
      createdBy: typeof UserId.Type,
      description?: string,
    ) => Effect.Effect<
      Task,
      | ValidationError
      | UnauthorizedError
      | FileSystemError
      | ParseResult.ParseError
    >;
    readonly findById: (
      taskId: typeof TaskId.Type,
    ) => Effect.Effect<
      Task,
      NotFoundError | FileSystemError | ParseResult.ParseError
    >;
    readonly listAll: () => Effect.Effect<
      Task[],
      FileSystemError | ParseResult.ParseError
    >;
    readonly listByUser: (
      userId: typeof UserId.Type,
    ) => Effect.Effect<
      Task[],
      NotFoundError | FileSystemError | ParseResult.ParseError
    >;

    readonly updateStatus: (
      taskId: typeof TaskId.Type,
      status: TaskStatus,
      userId: typeof UserId.Type,
    ) => Effect.Effect<
      Task,
      | NotFoundError
      | UnauthorizedError
      | FileSystemError
      | ParseResult.ParseError
    >;
    readonly assignToUser: (
      taskId: typeof TaskId.Type,
      assigneeId: typeof UserId.Type,
      requesterId: typeof UserId.Type,
    ) => Effect.Effect<
      Task,
      | NotFoundError
      | UnauthorizedError
      | FileSystemError
      | ParseResult.ParseError
    >;
  }
>() {
  static readonly layer = Layer.effect(
    TaskService,
    Effect.gen(function* () {
      const storage = yield* Storage;
      const userService = yield* UserService;

      const create = (
        title: string,
        priority: TaskPriority,
        createdBy: typeof UserId.Type,
        description?: string,
      ): Effect.Effect<
        Task,
        | ValidationError
        | UnauthorizedError
        | FileSystemError
        | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          if (title.trim() === "") {
            return yield* ValidationError.make({
              field: "title",
              message: "Title can not be empty",
            });
          }

          yield* userService.findById(createdBy).pipe(
            Effect.catchTag("NotFoundError", () =>
              UnauthorizedError.make({
                action: "Unauthorized user cannot create tasks",
              }),
            ),
          );

          const tasks = yield* storage.loadTasks();
          const newTask = new Task({
            id: TaskId.make(`task-${Math.random().toString(36).slice(2)}`),
            title,
            description,
            createdBy,
            status: "pending",
            taskPriority: priority ?? "low",
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          yield* storage.saveTasks([...tasks, newTask]);
          return newTask;
        });

      const findById = (
        taskid: typeof TaskId.Type,
      ): Effect.Effect<
        Task,
        NotFoundError | FileSystemError | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          const tasks = yield* storage.loadTasks();
          const task = tasks.find((t) => t.id === taskid);
          if (!task) {
            return yield* NotFoundError.make({
              resource: "findById",
              id: taskid,
            });
          }
          return task;
        });

      const listAll = (): Effect.Effect<
        Task[],
        FileSystemError | ParseResult.ParseError
      > => storage.loadTasks();

      const listByUser = (
        userId: typeof UserId.Type,
      ): Effect.Effect<
        Task[],
        NotFoundError | FileSystemError | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          yield* userService.findById(userId).pipe(
            Effect.mapError((err) =>
              NotFoundError.make({
                resource: "userId",
                id: userId,
              }),
            ),
          );

          const tasks = yield* storage.loadTasks();
          return tasks.filter((task) => task.createdBy === userId);
        });

      const updateStatus = (
        taskId: typeof TaskId.Type,
        status: TaskStatus,
        userId: typeof UserId.Type,
      ): Effect.Effect<
        Task,
        | UnauthorizedError
        | NotFoundError
        | FileSystemError
        | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          const tasks = yield* storage.loadTasks();
          const task = tasks.find((t) => t.id === taskId);
          if (!task) {
            return yield* NotFoundError.make({
              resource: "UpdateTask",
              id: taskId,
            });
          }
          if (task.createdBy !== userId) {
            return yield* UnauthorizedError.make({
              action: "User does not have permission to update this task",
            });
          }

          const updatedTask = new Task({
            ...task,
            status,
          });

          const updatedTasks = tasks.map((t) =>
            t.id === taskId ? updatedTask : t,
          );

          yield* storage.saveTasks(updatedTasks);
          return updatedTask;
        });

      const assignToUser = (
        taskId: typeof TaskId.Type,
        assigneeId: typeof UserId.Type,
        requesterId: typeof UserId.Type,
      ): Effect.Effect<
        Task,
        | NotFoundError
        | UnauthorizedError
        | FileSystemError
        | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          const tasks = yield* storage.loadTasks();
          const task = tasks.find((t) => t.id === taskId);
          if (!task) {
            return yield* NotFoundError.make({
              resource: "AssignTask",
              id: taskId,
            });
          }

          if (task.createdBy !== requesterId) {
            return yield* UnauthorizedError.make({
              action: "Assigning task",
            });
          }
          yield* userService.findById(assigneeId).pipe(
            Effect.catchTag("NotFoundError", () =>
              UnauthorizedError.make({
                action: "UnauthorizedError, user does not exists",
              }),
            ),
          );

          const updatedTask = new Task({
            ...task,
            assignedTo: assigneeId,
          });

          const updatedTasks = tasks.map((t) =>
            t.id === taskId ? updatedTask : t,
          );
          yield* storage.saveTasks(updatedTasks);

          return updatedTask;
        });

      return TaskService.of({
        create,
        findById,
        listAll,
        listByUser,
        updateStatus,
        assignToUser,
      });
    }),
  );
}
