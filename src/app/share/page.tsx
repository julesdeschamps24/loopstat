import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ShareEditor } from "@/components/share/share-editor";
import { getProfile } from "@/db/queries/users";
import {
  CONTEXT_PRESETS,
  parseShareCardParams,
  type ShareCardConfig,
  type ShareContext,
} from "@/lib/share/card-config";

export const dynamic = "force-dynamic";

const KNOWN_CONTEXTS: ShareContext[] = [
  "dashboard",
  "tracks",
  "artists",
  "albums",
];

function isKnownContext(v: string | undefined): v is ShareContext {
  return v !== undefined && (KNOWN_CONTEXTS as string[]).includes(v);
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const profile = await getProfile(session.user.id);
  if (!profile?.username || !profile.isPublic) {
    redirect("/settings?from=share");
  }

  const params = await searchParams;
  let config: ShareCardConfig = parseShareCardParams(params);

  // Apply context preset only when no explicit fields are set (i.e. the
  // user just clicked "Customize…" from a page - we don't override their
  // hand-edited URL on subsequent reloads).
  const contextRaw = params.context;
  const contextValue = Array.isArray(contextRaw) ? contextRaw[0] : contextRaw;
  if (
    isKnownContext(contextValue) &&
    !params.mode &&
    !params.type &&
    !params.format
  ) {
    const preset = CONTEXT_PRESETS[contextValue];
    config = { ...config, ...preset };
  }

  return (
    <main
      id="main"
      className="flex-1 flex flex-col px-6 py-10 max-w-6xl mx-auto w-full"
    >
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Personnaliser ma carte</h1>
        <p className="text-sm text-muted-foreground">
          Profil public : <span className="font-mono">@{profile.username}</span>
        </p>
      </header>
      <ShareEditor
        initialConfig={config}
        username={profile.username}
      />
    </main>
  );
}
