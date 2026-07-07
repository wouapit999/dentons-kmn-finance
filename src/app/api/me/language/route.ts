import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { changeLanguageSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { locale } = changeLanguageSchema.parse(await req.json());
    await prisma.user.update({ where: { id: user.id }, data: { locale } });
    return { ok: true, locale };
  });
}
