import { Context, Effect, Layer, ParseResult, Schedule, Schema } from "effect";
import {
  Email,
  Task,
  TaskId,
  TaskPriority,
  TaskStatus,
  User,
  UserId,
} from "src/domain/models.js";
import {
  DuplicateError,
  FileSystemError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "src/errors/index.js";
import { Storage } from "src/infrastructure/storage.js";

export class UserService extends Context.Tag(
  "@template/basic/service/indes/UserService",
)<
  UserService,
  {
    readonly register: (
      email: string,
      name: string,
    ) => Effect.Effect<
      User,
      | ValidationError
      | DuplicateError
      | FileSystemError
      | ParseResult.ParseError
    >;
    readonly findById: (
      id: typeof UserId.Type,
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

      const register = (
        name: string,
        email: string,
      ): Effect.Effect<
        User,
        | DuplicateError
        | FileSystemError
        | ValidationError
        | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          if (name.trim() === "") {
            return yield* ValidationError.make({
              field: "name",
              message: "Name cannot be empty",
            });
          }

          const validateEmail = yield* Effect.try({
            try: () => Email.make(email),
            catch: () =>
              ValidationError.make({
                field: "email",
                message: "Email is not valid",
              }),
          });

          const users = yield* storage.loadUsers();
          const existingUser = users.find((u) => u.email === validateEmail);
          if (existingUser) {
            return yield* DuplicateError.make({
              field: "email",
              resource: "User",
              value: email,
            });
          }

          const newUser: User = new User({
            id: UserId.make(
              `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            ),
            email: validateEmail,
            name,
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

export class TaskService extends Context.Tag(
  "@template/basic/service/index/TaskService",
)<
  TaskService,
  {
    readonly create: (
      title: string,
      description: string | undefined,
      priority: TaskPriority,
      createdBy: typeof UserId.Type,
    ) => Effect.Effect<
      Task,
      | ValidationError
      | UnauthorizedError
      | ParseResult.ParseError
      | FileSystemError
    >;
    findById: (
      taskId: typeof TaskId.Type,
    ) => Effect.Effect<
      Task,
      NotFoundError | FileSystemError | ParseResult.ParseError
    >;
    listAll: () => Effect.Effect<
      Task[],
      FileSystemError | ParseResult.ParseError
    >;
    listByUser: (
      userId: typeof UserId.Type,
    ) => Effect.Effect<Task[], FileSystemError | ParseResult.ParseError>;
    updateStatus: (
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
    assignedTask: (
      taskId: typeof TaskId.Type,
      assineeId: typeof UserId.Type,
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
        description: string | undefined,
        priority: TaskPriority,
        createdBy: typeof UserId.Type,
      ) =>
        Effect.gen(function* () {
          if (title.trim() === "") {
            return yield* ValidationError.make({
              field: "title",
              message: "Title cannot be empty",
            });
          }
          yield* userService.findById(createdBy).pipe(
            Effect.catchTag("NotFoundError", () =>
              Effect.fail(
                UnauthorizedError.make({
                  action: "Create Task - user does not exist",
                }),
              ),
            ),
          );

          const tasks = yield* storage.loadTasks();
          const newTask: Task = new Task({
            id: TaskId.make(
              `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            ),
            title,
            description,
            taskPriority: priority ?? "low",
            createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: "pending",
          });

          yield* storage.saveTasks([...tasks, newTask]);
          return newTask;
        });

      const findById = (
        taskId: typeof TaskId.Type,
      ): Effect.Effect<
        Task,
        NotFoundError | FileSystemError | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          const tasks = yield* storage.loadTasks();
          const task = tasks.find((t) => t.id === taskId);
          if (!task) {
            return yield* NotFoundError.make({
              resource: "Task",
              id: taskId,
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
      ): Effect.Effect<Task[], FileSystemError | ParseResult.ParseError> =>
        Effect.gen(function* () {
          const allTasks = yield* storage.loadTasks();
          return allTasks.filter((t) => t.createdBy === userId);
        });

      const updateStatus = (
        taskId: typeof TaskId.Type,
        status: TaskStatus,
        userId: typeof UserId.Type,
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
              resource: "Task",
              id: String(taskId),
            });
          }

          if (task.createdBy !== userId) {
            return yield* UnauthorizedError.make({
              action: "Create task - user not authorized",
            });
          }

          const updatedTask = new Task({
            ...task,
            status,
            updatedAt: new Date(),
            completedAt: status === "completed" ? new Date() : task.completedAt,
          });

          const updatedTasks = tasks.map((t) =>
            t.id === taskId ? updatedTask : t,
          );

          yield* storage.saveTasks(updatedTasks);
          return updatedTask;
        });

      const assignedTask = (
        taskId: typeof TaskId.Type,
        assineeId: typeof UserId.Type,
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
              resource: "Task",
              id: taskId,
            });
          }
          if (task.createdBy !== requesterId) {
            return yield* UnauthorizedError.make({
              action: "Assign Task - requester not authorized",
            });
          }

          yield* userService.findById(assineeId).pipe(
            Effect.catchTag("NotFoundError", () =>
              Effect.fail(
                UnauthorizedError.make({
                  action: "Assign Task - user does not exist",
                }),
              ),
            ),
          );

          const updatedTask = new Task({
            ...task,
            assignedTo: assineeId,
            updatedAt: new Date(),
          });

          const updatedTasks = tasks.map((t) =>
            t.id === taskId ? updatedTask : t,
          );
          yield* storage.saveTasks(updatedTasks);

          return updatedTask;
        });

      return TaskService.of({
        create,
        assignedTask,
        findById,
        listAll,
        listByUser,
        updateStatus,
      });
    }),
  );
}
