import { Schema } from "effect";

export class UserId extends Schema.String.pipe(Schema.brand("UserId")) {}
export class TaskId extends Schema.String.pipe(Schema.brand("TaskId")) {}

export class Email extends Schema.String.pipe(
  Schema.filter((email) => email.includes("@") && email.includes("."), {
    message: () => "Email must contain '@' and '.'",
  }),
  Schema.brand("Email"),
) {}

export class User extends Schema.Class<User>("User")({
  id: UserId,
  email: Email,
  name: Schema.String.pipe(
    Schema.minLength(1, {
      message: () => "Name must be more than 1 character",
    }),
  ),
  createdAt: Schema.Date,
}) {}

export const TaskStatus = Schema.Literal("pending", "in-progress", "completed");
export type TaskStatus = typeof TaskStatus.Type;

export const TaskPriority = Schema.Literal("low", "medium", "high");
export type TaskPriority = typeof TaskPriority.Type;

export class Task extends Schema.Class<Task>("Task")({
  id: TaskId,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  status: TaskStatus,
  taskPriority: TaskPriority,
  assignedTo: Schema.optional(UserId),
  createdBy: UserId,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  compoletedAt: Schema.optional(Schema.Date),
}) {}

export const createTask = (params: {
  title: string;
  description?: string;
  createdBy: typeof UserId.Type;
  taskPriority: TaskPriority;
}): Task =>
  new Task({
    id: TaskId.make(
      `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ),
    title: params.title,
    status: "pending",
    description: params.description,
    createdBy: params.createdBy,
    taskPriority: params.taskPriority,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

export const UserJson = Schema.encodedSchema(User);
export const TaskJson = Schema.encodedSchema(Task);
