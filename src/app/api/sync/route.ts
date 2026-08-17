// Spotify poll-recent sync is removed - imports handle catalog enrichment now.
// This endpoint is kept as a stub to avoid 404 surprises for old clients.
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return Response.json({ ok: true, removed: true }, { status: 200 });
}
