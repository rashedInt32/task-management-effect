import { Context, Effect, Layer, ParseResult, Schema } from "effect";
import { join } from "path";
import { promises as fs } from "node:fs";
import { Task, User } from "src/domain/models.js";
import { FileSystemError } from "src/errors/index.js";

type StorageError = FileSystemError | ParseResult.ParseError;

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
  const userPath = join(dataDir, "users.json");
  const taskPath = join(dataDir, "tasks.json");

  const ensureDir = Effect.tryPromise({
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
            operation: "readFile",
            path: filePath,
            error,
          }),
      });

      const parsed = JSON.parse(content) as I[];
      return yield* Effect.all(
        parsed.map((item) => Schema.decode(schema)(item)),
      );
    }).pipe(
      Effect.catchTag("FileSystemError", (error) => {
        const errorObj = error.error as {
          name?: string;
          code?: string;
          message?: string;
        };
        if (errorObj && errorObj.code === "ENOENT") {
          return Effect.succeed([]);
        }
        return Effect.fail(error);
      }),
    );

  return Storage.of({
    saveUsers: (users) => saveData(userPath, users, User),
    loadUsers: () => loadData(userPath, User),
    saveTasks: (tasks) => saveData(taskPath, tasks, Task),
    loadTasks: () => loadData(userPath, Task),
  });
};

export const makeStorageLayer = (dataDir: string) =>
  Layer.sync(Storage, () => makeFileStorage(dataDir));
