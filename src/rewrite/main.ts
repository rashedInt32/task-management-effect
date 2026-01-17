import { Effect, Layer } from "effect";
import { makeStorageLayer } from "src/infrastructure/storage.js";
import { TaskService, UserService } from "src/service/index.js";

const AppLayer = TaskService.layer.pipe(
  Layer.provideMerge(UserService.layer),
  Layer.provideMerge(makeStorageLayer("./data")),
);

const demoProgram = Effect.gen(function* () {
  const userService = yield* UserService;
  const taskService = yield* TaskService;

  yield* Effect.log("=== Task Management Demo ===");

  yield* Effect.logInfo("Registering user 'Alice'...");

  const alice = yield* userService.register("alice@admin.com", "Alice");

  yield* Effect.logInfo(`User registered: ${alice.name} ${alice.email}`);

  yield* Effect.log("Registering user 'Bob'...");

  const bob = yield* userService.register("bob@admin.com", "Bob");

  yield* Effect.logInfo(`User registered: ${bob.name} - ${bob.email}`);

  yield* Effect.log("Creating tasks...");

  const task1 = yield* taskService.create(
    "Shows demo",
    "Some description",
    "high",
    alice.id,
  );

  yield* Effect.logInfo(
    `Task1 created : ${task1.title} - ${task1.description}`,
  );

  const task2 = yield* taskService.create(
    "Anothder tasks",
    undefined,
    "low",
    bob.id,
  );

  yield* Effect.logInfo(
    `Task2 is created : ${task2.title} - ${task2.description}`,
  );

  yield* Effect.log("Update task status");

  yield* taskService
    .updateStatus(task2.id, "in-progress", bob.id)
    .pipe(
      Effect.tap((task) =>
        Effect.logInfo(
          `From effect tap Updated task status of task2 ${task.status}`,
        ),
      ),
    );

  yield* Effect.log("Task List by user");
  yield* taskService
    .listByUser(alice.id)
    .pipe(Effect.tap((task) => Effect.logInfo(task)));
});

const main = demoProgram.pipe(Effect.provide(AppLayer));

Effect.runPromise(main);
