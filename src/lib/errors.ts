import { ZodError } from "zod";

export function errorMessage(error: unknown, fallback = "Unexpected error. Please retry.") {
  if (error instanceof ZodError)
    return error.issues.map((issue) => issue.message).join(" ");
  return error instanceof Error ? error.message : fallback;
}
