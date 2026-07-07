import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";

/** Wrap a route handler to translate known errors into JSON responses. */
export function handle<T>(fn: () => Promise<T>) {
  return fn().then(
    (data) => NextResponse.json(data),
    (err) => {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "validation_error", issues: err.flatten() },
          { status: 422 },
        );
      }
      console.error(err);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    },
  );
}
