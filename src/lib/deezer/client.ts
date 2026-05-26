export class DeezerError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyText: string,
  ) {
    super(`Deezer ${path} failed: ${status}`);
    this.name = "DeezerError";
  }
}

const API_BASE = "https://api.deezer.com";

export async function deezerFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new DeezerError(res.status, path, bodyText);
  }
  return (await res.json()) as T;
}
