"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  status: string;
  roles: { key: string; name: string }[];
  lastLoginAt: string | null;
}
interface RoleOption {
  id: string;
  name: string;
  key: string;
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function UsersPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rolesFor, setRolesFor] = useState<UserRow | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  const users = useQuery({ queryKey: ["users"], queryFn: () => json<UserRow[]>("/api/users") });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => json<RoleOption[]>("/api/roles") });
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const me = await json<{ id: string }>("/api/me");
      setMeId(me.id);
      return me;
    },
  });

  const toggle = useMutation({
    mutationFn: async (u: UserRow) => {
      if (u.status === "DISABLED") {
        await fetch(`/api/users/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        });
      } else {
        await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("users.title")}</h1>
          <p className="text-sm text-slate-500">{t("users.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ {t("users.new")}</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("users.fullName")}</th>
              <th className="px-4 py-3">{t("users.email")}</th>
              <th className="px-4 py-3">{t("users.roles")}</th>
              <th className="px-4 py-3">{t("users.status")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.fullName}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.key} color="brand">{r.name}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge color={u.status === "ACTIVE" ? "green" : u.status === "DISABLED" ? "red" : "amber"}>
                    {u.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {u.id !== meId && (
                      <Button size="sm" variant="outline" onClick={() => setRolesFor(u)}>
                        {t("users.editRoles")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={u.status === "DISABLED" ? "outline" : "danger"}
                      onClick={() => toggle.mutate(u)}
                      disabled={toggle.isPending || u.id === meId}
                    >
                      {u.status === "DISABLED" ? t("users.activate") : t("users.deactivate")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <NewUserDialog
          roles={roles.data ?? []}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}
      {rolesFor && (
        <EditRolesDialog
          user={rolesFor}
          roles={roles.data ?? []}
          onClose={() => setRolesFor(null)}
          onSaved={() => {
            setRolesFor(null);
            qc.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}
    </div>
  );
}

function NewUserDialog({
  roles,
  onClose,
  onCreated,
}: {
  roles: RoleOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  async function submit(data: any) {
    setError(null);
    if (selected.length === 0) {
      setError("Assign at least one role");
      return;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, roleIds: selected }),
    });
    if (!res.ok) {
      setError("Could not create user (check the fields).");
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("users.new")}</h2>
        <form onSubmit={handleSubmit(submit)} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("users.fullName")}</label>
            <Input {...register("fullName", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("users.email")}</label>
            <Input type="email" {...register("email", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("users.password")}</label>
            <Input type="text" {...register("password", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("users.roles")}</label>
            <div className="grid grid-cols-2 gap-1">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    value={r.id}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id),
                      )
                    }
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.create")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EditRolesDialog({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: UserRow;
  roles: RoleOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  // Pre-select the user's current roles (match by role key).
  const currentKeys = new Set(user.roles.map((r) => r.key));
  const [selected, setSelected] = useState<string[]>(
    roles.filter((r) => currentKeys.has(r.key)).map((r) => r.id),
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selected }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "failed");
      }
    },
    onSuccess: onSaved,
    onError: (e: Error) =>
      setError(e.message === "cannot_edit_own_roles" ? t("users.ownRoles") : e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("users.editRolesTitle")}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {user.fullName} · {user.email}
        </p>
        <div className="grid grid-cols-2 gap-1">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id),
                  )
                }
              />
              {r.name}
            </label>
          ))}
        </div>
        {selected.length === 0 && (
          <p className="mt-2 text-sm text-amber-600">{t("users.minOneRole")}</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={selected.length === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            {t("common.save")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
