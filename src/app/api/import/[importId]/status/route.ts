import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { imports } from "@/db/schema";

// Reads per-user import state and depends on the session cookie — never cached.
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ importId: string }> },
): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { importId } = await ctx.params;

  try {
    const [row] = await db
      .select({
        userId: imports.userId,
        status: imports.status,
        filesCount: imports.filesCount,
        rowsImported: imports.rowsImported,
        errorMessage: imports.errorMessage,
      })
      .from(imports)
      .where(eq(imports.id, importId))
      .limit(1);

    // 404 (not 403) when the import belongs to someone else — don't reveal it exists.
    if (!row || row.userId !== userId) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    return Response.json(
      {
        status: row.status,
        filesCount: row.filesCount,
        rowsImported: row.rowsImported,
        errorMessage: row.errorMessage,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[api/import/status] failed to read import",
      importId,
      "for user",
      userId,
      err,
    );
    return Response.json({ error: "status_failed" }, { status: 500 });
  }
}
