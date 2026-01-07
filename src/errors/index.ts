import { Schema } from "effect";

export class ValidationError extends Schema.TaggedError<ValidationError>(
  "ValidationError",
)("ValidationError", {
  field: Schema.String,
  message: Schema.String,
}) {}

export class NotFoundError extends Schema.TaggedError<NotFoundError>(
  "NotFoundError",
)("NotFoundError", {
  resource: Schema.String,
  id: Schema.String,
}) {}

export class DuplicateError extends Schema.TaggedError<DuplicateError>(
  "DuplicateError",
)("DuplicateError", {
  resource: Schema.String,
  field: Schema.String,
  value: Schema.String,
}) {}

export class UnauthrizedError extends Schema.TaggedError<UnauthrizedError>(
  "UnauthrizedError",
)("UnauthrizedError", {
  action: Schema.String,
}) {}

export class FileSystemError extends Schema.TaggedError<FileSystemError>(
  "FileSystemError",
)("FileSystemError", {
  operation: Schema.String,
  path: Schema.String,
  error: Schema.Defect,
}) {}

export type AppError =
  | ValidationError
  | NotFoundError
  | DuplicateError
  | UnauthrizedError
  | FileSystemError;
