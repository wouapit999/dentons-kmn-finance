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
      // Prisma known request errors (duck-typed so we don't pull the whole
      // namespace in): translate the common ones instead of leaking a 500.
      const e = err as { code?: string; meta?: { target?: string[] | string } };
      if (typeof e?.code === "string" && /^P\d{4}$/.test(e.code)) {
        const target = Array.isArray(e.meta?.target)
          ? e.meta!.target!.join(", ")
          : typeof e.meta?.target === "string"
            ? e.meta.target
            : undefined;
        if (e.code === "P2002") {
          return NextResponse.json(
            { error: "duplicate_value", field: target ?? null },
            { status: 409 },
          );
        }
        if (e.code === "P2003") {
          return NextResponse.json({ error: "invalid_reference" }, { status: 422 });
        }
        if (e.code === "P2025") {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
      }
      console.error(err);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    },
  );
}
