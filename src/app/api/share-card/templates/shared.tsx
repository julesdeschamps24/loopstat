/* eslint-disable @next/next/no-img-element */
// Templates here are consumed by `next/og` (Satori) which renders to PNG
// server-side; the Next image optimizer doesn't apply, so the native
// <img> tag is the correct primitive.
import type { ReactNode } from "react";

import type { ShareBackground, SharePeriod } from "@/lib/share/card-config";

export const COLORS = {
  bg: "#070710",
  accent: "#7c3aed",
  text: "#f4f0ff",
  textMuted: "rgba(244,240,255,0.55)",
  textFaint: "rgba(244,240,255,0.35)",
  card: "rgba(124,58,237,0.3)",
};

export const PERIOD_LABEL: Record<SharePeriod, string> = {
  "1w": "Dernière semaine",
  "4w": "4 dernières semaines",
  "6m": "6 derniers mois",
  "1y": "12 derniers mois",
  all: "Tout l'historique",
};

type CommonStyle = {
  display?: "flex";
  flexDirection?: "row" | "column";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around";
  gap?: number;
  margin?: number;
  marginTop?: number | "auto";
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  width?: number | string;
  height?: number | string;
  flex?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  background?: string;
  borderRadius?: number;
  lineHeight?: number;
  opacity?: number;
  flexWrap?: "wrap" | "nowrap";
  flexShrink?: number;
  minWidth?: number | string;
  maxWidth?: number | string;
  objectFit?: "cover" | "contain";
  position?: "absolute" | "relative";
  top?: number;
  left?: number;
  overflow?: "hidden" | "visible";
};

/** Vertical flex container (always display:flex per Satori). */
export function Stack({
  children,
  style,
}: {
  children: ReactNode;
  style?: CommonStyle;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      {children}
    </div>
  );
}

/** Horizontal flex container. */
export function HStack({
  children,
  style,
}: {
  children: ReactNode;
  style?: CommonStyle;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Avatar + display name + @username header. */
export function CardHeader({
  displayName,
  username,
  avatarUrl,
  scale = 1,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  scale?: number;
}) {
  const size = Math.round(96 * scale);
  return (
    <HStack style={{ gap: Math.round(20 * scale) }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          width={size}
          height={size}
          alt=""
          style={{ borderRadius: size, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: size,
            background: COLORS.accent,
            color: COLORS.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(48 * scale),
            fontWeight: 700,
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <Stack>
        <div
          style={{
            display: "flex",
            fontSize: Math.round(48 * scale),
            fontWeight: 700,
            lineHeight: 1,
            color: COLORS.text,
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: Math.round(22 * scale),
            color: COLORS.textMuted,
            marginTop: Math.round(6 * scale),
          }}
        >
          @{username}
        </div>
      </Stack>
    </HStack>
  );
}

/** Section label like "TOP TITRES · 4 SEMAINES". */
export function SectionLabel({
  text,
  scale = 1,
}: {
  text: string;
  scale?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: Math.round(16 * scale),
        color: COLORS.textMuted,
        letterSpacing: Math.round(3 * scale),
      }}
    >
      {text}
    </div>
  );
}

/** Numbered row with optional cover + title + subtitle. */
export function RankRow({
  rank,
  title,
  subtitle,
  imageUrl,
  scale = 1,
  maxTitleChars = 40,
  maxSubtitleChars = 50,
}: {
  rank: number;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  scale?: number;
  maxTitleChars?: number;
  maxSubtitleChars?: number;
}) {
  const coverSize = Math.round(64 * scale);
  return (
    <HStack style={{ gap: Math.round(16 * scale), marginTop: Math.round(14 * scale) }}>
      <div
        style={{
          display: "flex",
          width: Math.round(44 * scale),
          fontSize: Math.round(32 * scale),
          color: COLORS.textFaint,
        }}
      >
        {String(rank)}
      </div>
      {imageUrl ? (
        <img
          src={imageUrl}
          width={coverSize}
          height={coverSize}
          alt=""
          style={{ borderRadius: Math.round(6 * scale) }}
        />
      ) : (
        <div
          style={{
            width: coverSize,
            height: coverSize,
            borderRadius: Math.round(6 * scale),
            background: COLORS.card,
            display: "flex",
          }}
        />
      )}
      <Stack style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            fontSize: Math.round(26 * scale),
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          {title.length > maxTitleChars ? `${title.slice(0, maxTitleChars - 1)}…` : title}
        </div>
        {subtitle ? (
          <div
            style={{
              display: "flex",
              fontSize: Math.round(20 * scale),
              color: COLORS.textMuted,
              marginTop: Math.round(2 * scale),
            }}
          >
            {subtitle.length > maxSubtitleChars ? `${subtitle.slice(0, maxSubtitleChars - 1)}…` : subtitle}
          </div>
        ) : null}
      </Stack>
    </HStack>
  );
}

export function Watermark({
  username,
  scale = 1,
}: {
  username: string;
  scale?: number;
}) {
  return (
    <div
      style={{
        marginTop: "auto",
        display: "flex",
        justifyContent: "flex-end",
        fontSize: Math.round(20 * scale),
        color: COLORS.textMuted,
      }}
    >
      loopstat.fr/u/{username}
    </div>
  );
}

/**
 * Background layer absolutely positioned over the whole card. Both
 * variants render edge-to-edge - content sits on top via a sibling
 * positioned container.
 */
export function Background({
  variant,
  width,
  height,
  covers,
}: {
  variant: ShareBackground;
  width: number;
  height: number;
  covers: string[];
}) {
  if (variant === "wall") {
    return <WallBackground width={width} height={height} covers={covers} />;
  }
  return <MeshBackground width={width} height={height} />;
}

function MeshBackground({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        background: `
          radial-gradient(circle at 20% 20%, rgba(124,58,237,0.55), transparent 50%),
          radial-gradient(circle at 80% 30%, rgba(236,72,153,0.45), transparent 55%),
          radial-gradient(circle at 50% 80%, rgba(56,189,248,0.4), transparent 55%),
          ${COLORS.bg}
        `,
      }}
    />
  );
}

function WallBackground({
  width,
  height,
  covers,
}: {
  width: number;
  height: number;
  covers: string[];
}) {
  // 6 columns × ceil(height/tileSize) rows, no gap, slight opacity so
  // the covers tile feels like an ambient texture not a photo grid.
  // If the caller provided fewer covers than the canvas can fit, we
  // repeat them - better to see the same album twice than to leave
  // the bottom half on the bare background color.
  const cols = 6;
  const tileSize = Math.ceil(width / cols);
  const needed = cols * Math.ceil(height / tileSize);
  const tiles: string[] = [];
  if (covers.length > 0) {
    while (tiles.length < needed) tiles.push(...covers);
    tiles.length = needed;
  }
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        background: COLORS.bg,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width,
          opacity: 0.22,
        }}
      >
        {tiles.map((url, i) => (
          <img
            key={`${i}-${url}`}
            src={url}
            width={tileSize}
            height={tileSize}
            alt=""
            style={{ objectFit: "cover" }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          background: `linear-gradient(180deg, rgba(124,58,237,0.18), rgba(7,7,16,0.78))`,
        }}
      />
    </div>
  );
}
