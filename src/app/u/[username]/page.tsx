import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { isPremium } from "@/db/queries/billing";
import { AlbumWall } from "@/components/album-wall";
import { RankedRow } from "@/components/stats/ranked-list";
import { db } from "@/db/client";
import { getWallCovers } from "@/db/queries/wall-covers";
import {
  getTopAlbumsFromStreams,
  getTopArtistsFromStreams,
  getTopTracksFromStreams,
} from "@/db/queries/stats";
import { getPublicProfileByUsername } from "@/db/queries/users";
import { users } from "@/db/schema";
import { ACCENT_HEX, isAccent, isBackground } from "@/lib/profile/appearance";
import { periodSince } from "@/lib/stats/period";
import { formatNumber } from "@/lib/utils";

// Profils publics : pas d'auth, mais on dépend de la base — toujours dynamique.
export const dynamic = "force-dynamic";

const TOP_LIMIT = 10;
const DEFAULT_PERIOD = "4w" as const;

type Params = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfileByUsername(username);
  if (!profile) {
    return { title: "Profil introuvable — loopstat" };
  }

  const name = profile.displayName ?? profile.username;
  const title = `${name} sur loopstat`;
  const description = `Découvre les top titres, artistes et albums de ${name} sur loopstat.`;
  const url = `https://loopstat.tech/u/${profile.username}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      siteName: "loopstat",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username } = await params;
  const profile = await getPublicProfileByUsername(username);
  if (!profile) notFound();

  const session = await auth();
  const isOwnProfile = session?.user?.id === profile.id;
  const ownerIsPremium = await isPremium(profile.id);

  // `getPublicProfileByUsername` returns the short summary used by the rest
  // of the page — we need a fresh DB hit for the appearance settings.
  const settingsRow = await db.query.users.findFirst({
    where: eq(users.id, profile.id),
    columns: { profileSettings: true },
  });
  const settings = settingsRow?.profileSettings ?? {};
  const background = isBackground(settings.background) ? settings.background : "mesh";
  const accent = isAccent(settings.accent) ? settings.accent : "violet";
  const accentHex = ACCENT_HEX[accent];

  const wallCovers =
    background === "wall"
      ? await getWallCovers(profile.id, periodSince("1y"), 40)
      : [];
  const paddedCovers: (string | null)[] = [
    ...wallCovers,
    ...Array<string | null>(Math.max(0, 40 - wallCovers.length)).fill(null),
  ];

  const mainStyle: React.CSSProperties = {
    // Allow children to read the accent via var(--ls-accent, #7c3aed)
    ["--ls-accent" as string]: accentHex,
    ...(background === "mesh"
      ? {
          background:
            "radial-gradient(circle at 20% 20%, rgba(124,58,237,0.55), transparent 50%), radial-gradient(circle at 80% 30%, rgba(236,72,153,0.35), transparent 55%), #070710",
        }
      : background === "noir"
        ? { background: "#070710" }
        : background === "mauve"
          ? { background: "linear-gradient(135deg, #2a1a40 0%, #070710 100%)" }
          : { background: "#070710" /* wall has its own component layer */ }),
  };

  const since = periodSince(DEFAULT_PERIOD);
  const [tracks, artists, albums] = await Promise.all([
    getTopTracksFromStreams(profile.id, since, TOP_LIMIT),
    getTopArtistsFromStreams(profile.id, since, TOP_LIMIT),
    getTopAlbumsFromStreams(profile.id, since, TOP_LIMIT),
  ]);

  const displayName = profile.displayName ?? profile.username;
  const hasAnyData = tracks.length + artists.length + albums.length > 0;

  return (
    <>
      {background === "wall" ? <AlbumWall covers={paddedCovers} /> : null}
      <main
        id="main"
        className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
        style={mainStyle}
      >
        {isOwnProfile ? (
          <aside
            role="status"
            style={{
              borderColor: "color-mix(in srgb, var(--ls-accent, #7c3aed) 30%, transparent)",
              background: "color-mix(in srgb, var(--ls-accent, #7c3aed) 10%, transparent)",
            }}
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
          >
            <span>
              {ownerIsPremium ? "👑" : "👤"}{" "}
              {ownerIsPremium
                ? "Profil Premium"
                : "Tu visites ton propre profil — c’est ce que voient les autres."}
            </span>
            <Link
              href="/settings"
              style={{ color: "var(--ls-accent, #7c3aed)" }}
              className="font-medium hover:underline"
            >
              Modifier mes réglages →
            </Link>
          </aside>
        ) : null}
        <header className="mb-10 flex flex-col items-center gap-4 text-center">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              width={96}
              height={96}
              className="size-24 rounded-full object-cover"
              style={{
                boxShadow: "0 0 0 4px color-mix(in srgb, var(--ls-accent, #7c3aed) 30%, transparent)",
              }}
            />
          ) : (
            <div
              className="size-24 rounded-full"
              style={{
                background: "color-mix(in srgb, var(--ls-accent, #7c3aed) 20%, transparent)",
                boxShadow: "0 0 0 4px color-mix(in srgb, var(--ls-accent, #7c3aed) 30%, transparent)",
              }}
            />
          )}
          <div>
            <h1 className="text-3xl font-semibold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">
              @{profile.username} · 4 dernières semaines
            </p>
          </div>
        </header>

        {!hasAnyData ? (
          <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Pas encore d&apos;écoutes à afficher pour cette période.
          </p>
        ) : (
          <div className="grid gap-10 md:grid-cols-3">
            <Section title="Top titres">
              {tracks.length === 0 ? (
                <EmptyHint />
              ) : (
                tracks.map((t, i) => (
                  <RankedRow
                    key={t.trackId}
                    rank={i + 1}
                    title={t.name}
                    subtitle={t.artistNames.join(", ")}
                    imageUrl={t.albumImageUrl ?? undefined}
                    metric={formatNumber(t.plays)}
                  />
                ))
              )}
            </Section>

            <Section title="Top artistes">
              {artists.length === 0 ? (
                <EmptyHint />
              ) : (
                artists.map((a, i) => (
                  <RankedRow
                    key={a.artistId}
                    rank={i + 1}
                    title={a.name}
                    imageUrl={a.imageUrl ?? undefined}
                    metric={formatNumber(a.plays)}
                  />
                ))
              )}
            </Section>

            <Section title="Top albums">
              {albums.length === 0 ? (
                <EmptyHint />
              ) : (
                albums.map((al, i) => (
                  <RankedRow
                    key={al.albumId}
                    rank={i + 1}
                    title={al.name}
                    subtitle={al.artistNames.join(", ")}
                    imageUrl={al.imageUrl ?? undefined}
                    metric={formatNumber(al.plays)}
                  />
                ))
              )}
            </Section>
          </div>
        )}

        <footer className="mt-16 flex flex-col items-center gap-3 border-t pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Tes propres stats Spotify, gratuitement.
          </p>
          <Link
            href="/login"
            className="rounded-full px-6 py-2.5 text-sm font-medium text-white transition"
            style={{
              background: "var(--ls-accent, #7c3aed)",
            }}
          >
            Connecte ton compte
          </Link>
        </footer>
      </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function EmptyHint() {
  return (
    <p className="rounded-xl border bg-card/40 p-3 text-xs text-muted-foreground">
      —
    </p>
  );
}
