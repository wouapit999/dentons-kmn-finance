"use client";
import { useQuery } from "@tanstack/react-query";

/**
 * Current user's permissions, for hiding actions the server would refuse.
 * The server guard is always the real gate — this only keeps the UI honest so
 * a read-only role never sees a button that 403s (or crashes the page).
 */
export function usePerms() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
    staleTime: 5 * 60 * 1000,
  });
  const permissions = me.data?.permissions ?? [];
  return {
    permissions,
    isLoading: me.isLoading,
    /** True when the signed-in user holds every permission given. */
    can: (...required: string[]) => required.every((p) => permissions.includes(p)),
    /** True when the signed-in user holds at least one of the permissions. */
    canAny: (...required: string[]) => required.some((p) => permissions.includes(p)),
  };
}

/** Fetch JSON, throwing on a non-2xx so an error body never becomes render data. */
export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
  return (await res.json()) as T;
}
