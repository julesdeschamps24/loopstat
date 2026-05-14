import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { imports } from "@/db/schema";
import { importQueue } from "../../../../worker/queue";

// Mutates server state (writes temp files, inserts a row, enqueues a job) and
// depends on the session cookie — never statically cached.
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const IMPORT_TMP_DIR = path.join(process.cwd(), ".import-tmp");

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return Response.json({ error: "no_files" }, { status: 400 });
  }
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      return Response.json(
        { error: "invalid_file_type", file: file.name },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json(
        { error: "file_too_large", file: file.name },
        { status: 400 },
      );
    }
  }

  // Visible in the catch block so cleanup can target the row + temp dir.
  let importId: string | undefined;

  try {
    // Create the imports row first so we have the id to name the temp dir.
    const [importRow] = await db
      .insert(imports)
      .values({ userId, status: "pending", filesCount: files.length })
      .returning({ id: imports.id });
    importId = importRow.id;

    // Persist files to .import-tmp/<importId>/ — the job reads them back from
    // disk so we don't push file buffers through Redis.
    const dir = path.join(IMPORT_TMP_DIR, importId);
    await mkdir(dir, { recursive: true });
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(dir, path.basename(file.name)), buffer);
    }

    await importQueue.add("import-history", { importId });

    return Response.json({ importId }, { status: 202 });
  } catch (err) {
    console.error("[api/import] failed to create import for user", userId, err);

    // Best-effort cleanup so a crash here doesn't leave an orphaned "pending"
    // row + dangling temp files. Wrapped so a cleanup failure can't mask `err`.
    if (importId) {
      const orphanedId = importId;
      await db
        .update(imports)
        .set({ status: "failed", errorMessage: "Upload failed" })
        .where(eq(imports.id, orphanedId))
        .catch(() => {});
      await rm(path.join(IMPORT_TMP_DIR, orphanedId), {
        recursive: true,
        force: true,
      }).catch(() => {});
    }

    return Response.json({ error: "import_failed" }, { status: 500 });
  }
}
