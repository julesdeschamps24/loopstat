import { auth } from "@/auth";
import { log } from "@/lib/log";
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

  const wlog = log.child({ route: "api/sync", userId });

  try {
    const job = await pollRecentQueue.add("poll-user", { userId });
    return Response.json({ ok: true, jobId: job.id }, { status: 202 });
  } catch (err) {
    wlog.error({ err }, "failed to enqueue poll-user job");
    return Response.json({ error: "enqueue_failed" }, { status: 500 });
  }
}
