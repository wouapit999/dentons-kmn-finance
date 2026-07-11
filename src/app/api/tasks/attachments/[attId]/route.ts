import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { taskVisibilityWhere } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// GET /api/tasks/attachments/:attId — download (visibility enforced via the task).
export async function GET(_req: NextRequest, { params }: { params: { attId: string } }) {
  try {
    const user = await requireUser();
    const att = await prisma.taskAttachment.findUnique({ where: { id: params.attId } });
    if (!att) throw new AuthError(404, "not_found");
    const task = await prisma.task.findFirst({
      where: {
        id: att.taskId,
        companyId: user.companyId,
        deletedAt: null,
        ...taskVisibilityWhere(user),
      },
      select: { id: true },
    });
    if (!task) throw new AuthError(404, "not_found");

    return new NextResponse(Buffer.from(att.data, "base64"), {
      headers: {
        "Content-Type": att.mime,
        "Content-Disposition": `attachment; filename="${att.filename.replace(/"/g, "")}"`,
      },
    });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "download_failed" }, { status });
  }
}
