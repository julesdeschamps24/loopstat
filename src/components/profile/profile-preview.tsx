"use client";

import { ACCENT_HEX, type Accent, type Background } from "@/lib/profile/appearance";

const BG_STYLE: Record<Background, React.CSSProperties> = {
  mesh: {
    background:
      "radial-gradient(circle at 30% 30%, rgba(124,58,237,0.55), transparent 50%), radial-gradient(circle at 70% 70%, rgba(56,189,248,0.4), transparent 55%), #070710",
  },
  wall: { background: "#1a0d2e" /* placeholder; live render is on /u/<username> */ },
  noir: { background: "#070710" },
  mauve: {
    background: "linear-gradient(135deg, #2a1a40 0%, #070710 100%)",
  },
};

export function ProfilePreview({
  username,
  displayName,
  background,
  accent,
}: {
  username: string;
  displayName: string;
  background: Background;
  accent: Accent;
}) {
  const accentHex = ACCENT_HEX[accent];
  return (
    <div
      className="aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl border p-4 text-xs text-white"
      style={BG_STYLE[background]}
    >
      <div className="flex items-center gap-2">
        <div
          className="size-8 rounded-full"
          style={{ background: accentHex }}
        />
        <div>
          <div className="font-semibold">{displayName}</div>
          <div className="font-mono opacity-60">@{username}</div>
        </div>
      </div>
      <div
        className="mt-3 inline-flex rounded-full px-2 py-0.5 text-[10px]"
        style={{ background: `${accentHex}22`, color: accentHex }}
      >
        Public
      </div>
    </div>
  );
}
