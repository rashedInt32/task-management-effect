import { Context, Effect, Layer, Schema } from "effect";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { Task, User } from "src/rewrite/domain/models.js";
import { FileSystemError, StorageError } from "src/rewrite/errors/index.js";

export class Storage extends Context.Tag(
  "@template/basic/infrastructure/storage",
)<
  Storage,
  {
    readonly saveUsers: (users: User[]) => Effect.Effect<void, StorageError>;
    readonly loadUsers: () => Effect.Effect<User[], StorageError>;
    readonly saveTasks: (tasks: Task[]) => Effect.Effect<void, StorageError>;
    readonly loadTasks: () => Effect.Effect<Task[], StorageError>;
  }
>() {}

export const makeFileStorage = (dataDir: string) => {
  const userPath = join(dataDir, "users.jon");
  const taskPath = join(dataDir, "tasks.jon");

  const ensureDir = Effect.try({
    try: () => fs.mkdir(dataDir, { recursive: true }),
    catch: (error) =>
      FileSystemError.make({
        operation: "mkdir",
        path: dataDir,
        error,
      }),
  });

  const saveData = <A, I>(
    filePath: string,
    data: A[],
    schema: Schema.Schema<A, I>,
  ): Effect.Effect<void, StorageError> =>
    Effect.gen(function* () {
      yield* ensureDir;

      const encoded = yield* Effect.all(
        data.map((item) => Schema.encode(schema)(item)),
      );

      return yield* Effect.tryPromise({
        try: () => fs.writeFile(filePath, JSON.stringify(encoded, null, 2)),
        catch: (error) =>
          FileSystemError.make({
            operation: "writeFile",
            path: filePath,
            error,
          }),
      });
    });

  const loadData = <A, I>(
    filePath: string,
    schema: Schema.Schema<A, I>,
  ): Effect.Effect<A[], StorageError> =>
    Effect.gen(function* () {
      const content = yield* Effect.tryPromise({
        try: () => fs.readFile(filePath, "utf-8"),
        catch: (error) =>
          FileSystemError.make({
            operation: "ReadFile",
            path: filePath,
            error,
          }),
      });

      const parsed = JSON.parse(content) as I[];

      return yield* Effect.all(
        parsed.map((item) => Schema.decode(schema)(item)),
      );
    });

  return Storage.of({
    saveUsers: (users) => saveData(userPath, users, User),
    loadUsers: () => loadData(userPath, User),
    saveTasks: (tasks) => saveData(taskPath, tasks, Task),
    loadTasks: () => loadData(taskPath, Task),
  });
};

export const makeStorageLayer = (dataDir: string) =>
  Layer.sync(Storage, () => makeFileStorage(dataDir));
