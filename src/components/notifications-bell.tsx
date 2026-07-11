"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useT } from "@/lib/useT";
import { Button } from "@/components/ui";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationsBell() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const inbox = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error();
      return (await res.json()) as { unread: number; items: Notif[] };
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = inbox.data?.unread ?? 0;

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" aria-label={t("notif.title")} onClick={() => setOpen((o) => !o)}>
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("notif.title")}
            </span>
            {unread > 0 && (
              <button
                className="text-xs text-brand hover:underline"
                onClick={() => markRead.mutate("all")}
              >
                {t("notif.markAll")}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(inbox.data?.items ?? []).length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-slate-400">{t("notif.empty")}</p>
            )}
            {inbox.data?.items.map((n) => (
              <button
                key={n.id}
                className={
                  "block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 " +
                  (n.read ? "opacity-60" : "")
                }
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                  setOpen(false);
                  if (n.linkPath) router.push(n.linkPath);
                }}
              >
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="truncate text-xs text-slate-500">{n.body}</div>}
                <div className="text-[10px] text-slate-400">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
