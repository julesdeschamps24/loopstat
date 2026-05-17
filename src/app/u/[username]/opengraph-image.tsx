import { ImageResponse } from "next/og";

import { isPremium } from "@/db/queries/billing";
import { getTopTracksFromStreams } from "@/db/queries/stats";
import { getPublicProfileByUsername } from "@/db/queries/users";
import { periodSince } from "@/lib/stats/period";

export const alt = "Profil loopstat";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#070710";
const ACCENT = "#7c3aed";
const TEXT = "#f4f0ff";
const TEXT_MUTED = "rgba(244,240,255,0.55)";
const TEXT_FAINT = "rgba(244,240,255,0.35)";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getPublicProfileByUsername(username);

  if (!profile) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: BG,
            color: TEXT,
            fontSize: 56,
          }}
        >
          loopstat
        </div>
      ),
      size,
    );
  }

  const hideWatermark = await isPremium(profile.id);

  const tracks = await getTopTracksFromStreams(
    profile.id,
    periodSince("4w"),
    3,
  );
  const displayName = profile.displayName ?? profile.username;
  const initial = displayName.charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: TEXT,
          padding: 60,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              background: ACCENT,
              color: TEXT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 700,
            }}
          >
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 24 }}>
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
              {displayName}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: TEXT_MUTED,
                marginTop: 6,
              }}
            >
              @{profile.username}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 50,
          }}
        >
          <div style={{ display: "flex", fontSize: 18, color: TEXT_MUTED }}>
            TOP TITRES - 4 DERNIERES SEMAINES
          </div>
          {tracks.length === 0 ? (
            <div
              style={{
                display: "flex",
                fontSize: 32,
                color: TEXT_FAINT,
                marginTop: 20,
              }}
            >
              Pas encore decoutes
            </div>
          ) : (
            tracks.map((t, i) => (
              <div
                key={t.trackId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: 22,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 38,
                    width: 60,
                    color: TEXT_FAINT,
                  }}
                >
                  {String(i + 1)}
                </div>
                {t.albumImageUrl ? (
                  <img
                    src={t.albumImageUrl}
                    width={72}
                    height={72}
                    alt=""
                    style={{ borderRadius: 8, marginLeft: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 8,
                      background: "rgba(124,58,237,0.3)",
                      display: "flex",
                      marginLeft: 8,
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginLeft: 20,
                  }}
                >
                  <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
                    {t.name.slice(0, 50)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 22,
                      color: TEXT_MUTED,
                      marginTop: 4,
                    }}
                  >
                    {t.artistNames.join(", ").slice(0, 60)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {!hideWatermark ? (
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              justifyContent: "flex-end",
              fontSize: 22,
              color: TEXT_MUTED,
            }}
          >
            loopstat.tech/u/{profile.username}
          </div>
        ) : null}
      </div>
    ),
    size,
  );
}
