import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      locale: user.locale,
      roleKeys: user.roleKeys,
      permissions: Array.from(user.permissions),
    };
  });
}
