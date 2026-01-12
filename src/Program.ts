import { Effect, Layer } from "effect";
import { UserId } from "src/domain/models.js";
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

  const bob = yield* userService.register("bob@admin.com", "Bob");
  yield* Effect.logInfo(`User registered: ${bob.name} - ${bob.email}`);

  yield* Effect.log("\n✅ Creating tasks...");
  const task1 = yield* taskService.create(
    "pick rinaaz from school",
    "This is regular task",
    "high",
    alice.id,
  );
  yield* Effect.logInfo(`Task1 created: ${task1.title} - ${task1.description}`);

  const task2 = yield* taskService.create(
    "Authenctication flow",
    undefined,
    "low",
    bob.id,
  );
  yield* Effect.logInfo(`Task2 created: ${task2.title} - ${task2.description}`);

  const task3 = yield* taskService.create(
    "Ci/CD pipeline setup",
    "Some descritpiont",
    "medium",
    alice.id,
  );
  yield* Effect.logInfo(`Task3 created: ${task3.title} - ${task3.description}`);

  yield* Effect.log("\n Assigning task to bob");
  const assigned = yield* taskService.assignedTask(task3.id, bob.id, alice.id);
  yield* Effect.logInfo(`${assigned.title} asigned to Bob`);

  yield* Effect.log("\n Adding status to task2");
  const updateStatus = yield* taskService.updateStatus(
    task2.id,
    "in-progress",
    bob.id,
  );
  yield* Effect.logInfo(
    `Status update of task 3 status: ${updateStatus.status}`,
  );

  yield* Effect.log("Listing all tasks");
  const allTasks = yield* taskService.listAll();

  yield* Effect.logInfo(`Total Task - ${allTasks.length}`);

  for (const task of allTasks) {
    yield* Effect.logInfo(
      `\n ${task.title} - ${task.description} - ${task.status}`,
    );
  }

  yield* Effect.log("=== Task List by user");
  const aliceTasks = yield* taskService.listByUser(alice.id);
  yield* Effect.logInfo(`Task created by alice ${aliceTasks}`);

  yield* Effect.log("=== Catching error demo");

  yield* Effect.log("Duplicate user registration");
  yield* userService.register("alice@admin.com", "Alice close").pipe(
    Effect.catchTag("DuplicateError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logWarning(
          `Caught expected error ${error.field} - ${error.value} already exists`,
        );
        return yield* userService.findById(alice.id);
      }),
    ),
  );

  yield* Effect.log("Trying to update task as wrong user...");
  yield* taskService.updateStatus(task1.id, "completed", bob.id).pipe(
    Effect.catchTag("UnauthrizedError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logWarning(`✓ Caught expected error: ${error.action}`);
        return task1;
      }),
    ),
  );

  yield* Effect.log("Trying to find non-existent user...");
  yield* userService
    .findById(UserId.make("fake-id"))
    .pipe(
      Effect.catchTag("NotFoundError", (error) =>
        Effect.logWarning(
          `✓ Caught expected error: ${error.resource} '${error.id}' not found`,
        ),
      ),
    );

  yield* Effect.log("\n✨ Demo completed successfully!");
});
