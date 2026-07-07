import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import type { Locale } from "@/lib/constants";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <Shell
      user={{
        fullName: user.fullName,
        email: user.email,
        locale: user.locale as Locale,
        permissions: Array.from(user.permissions),
      }}
    >
      {children}
    </Shell>
  );
}
