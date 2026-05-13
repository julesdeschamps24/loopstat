import { auth } from "@/auth";
import { pollRecentQueue } from "../../../../worker/queue";

// This route mutates server state (enqueues a job) and depends on the session
// cookie — it must never be statically cached.
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const job = await pollRecentQueue.add("poll-user", { userId });
    return Response.json({ ok: true, jobId: job.id }, { status: 202 });
  } catch (err) {
    console.error("[api/sync] failed to enqueue poll-user job for user", userId, err);
    return Response.json({ error: "enqueue_failed" }, { status: 500 });
  }
}
