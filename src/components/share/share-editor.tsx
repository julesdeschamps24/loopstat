"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, Download, Link as LinkIcon, Share2 } from "lucide-react";

import { Preview } from "@/components/share/preview";
import {
  FORMAT_N_OPTIONS,
  SHARE_BACKGROUNDS,
  SHARE_FORMATS,
  SHARE_MODES,
  SHARE_PERIODS,
  SHARE_TYPES,
  buildShareCardUrl,
  clampNForFormat,
  type ShareCardConfig,
  type ShareFormat,
  type SharePeriod,
} from "@/lib/share/card-config";
import { cn } from "@/lib/utils";

const PERIOD_LABEL: Record<SharePeriod, string> = {
  "1w": "1 sem",
  "4w": "4 sem",
  "6m": "6 mois",
  "1y": "1 an",
  all: "Tout",
};

const FORMAT_LABEL: Record<ShareFormat, string> = {
  twitter: "Twitter",
  post: "Post",
  story: "Story",
};

const TYPE_LABEL = {
  tracks: "Titres",
  artists: "Artistes",
  albums: "Albums",
} as const;

const MODE_LABEL = {
  focus: "Focus",
  recap: "Recap",
} as const;

const BG_LABEL = {
  mesh: "Mesh",
  wall: "Pochettes",
} as const;

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// Debounce delay (ms) between the user's last tweak and the actual
// preview re-fetch. Each /api/share-card hit does a DB query + Satori
// render + 1-37 Spotify CDN image fetches, so rapid chip clicking
// without debounce piles up wasted requests. 300ms feels instant after
// the user stops moving but kills the spam.
const PREVIEW_DEBOUNCE_MS = 300;

export function ShareEditor({
  initialConfig,
  username,
}: {
  initialConfig: ShareCardConfig;
  username: string;
}) {
  const [config, setConfig] = useState<ShareCardConfig>(initialConfig);
  const [committedConfig, setCommittedConfig] =
    useState<ShareCardConfig>(initialConfig);
  const [copied, setCopied] = useState(false);
  const isClient = useIsClient();

  // Debounce: UI controls update `config` immediately (chips light up
  // right away), but `committedConfig` only catches up after the user
  // stops interacting for PREVIEW_DEBOUNCE_MS. The preview URL + the
  // browser URL both follow `committedConfig`.
  useEffect(() => {
    const t = setTimeout(() => setCommittedConfig(config), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [config]);

  // Mirror committed config → URL (no full nav).
  useEffect(() => {
    if (!isClient) return;
    const sp = new URLSearchParams({
      mode: committedConfig.mode,
      type: committedConfig.type,
      n: String(committedConfig.n),
      period: committedConfig.period,
      format: committedConfig.format,
      bg: committedConfig.bg,
    });
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [committedConfig, isClient]);

  // Preview URL follows the debounced config (avoids spamming the
  // render endpoint mid-tweak).
  const previewUrl = useMemo(
    () => buildShareCardUrl(committedConfig, username),
    [committedConfig, username],
  );
  // Download + native share use the LIVE config: the user clicking
  // "Download" wants exactly what they last clicked, not what was
  // committed 300ms ago.
  const liveUrl = useMemo(
    () => buildShareCardUrl(config, username),
    [config, username],
  );

  function patch(p: Partial<ShareCardConfig>) {
    setConfig((cur) => {
      const next = { ...cur, ...p };
      // If format changes, clamp n into the new format's options.
      if (p.format && p.format !== cur.format) {
        next.n = clampNForFormat(p.format, cur.n);
      }
      return next;
    });
  }

  async function copyEditorLink() {
    if (!isClient) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable on non-HTTPS context */
    }
  }

  const canNativeShare = isClient && "share" in navigator;
  async function nativeShare() {
    if (!("share" in navigator)) return;
    try {
      const res = await fetch(liveUrl);
      const blob = await res.blob();
      const file = new File([blob], `loopstat-${username}-${config.format}.png`, {
        type: "image/png",
      });
      if ("canShare" in navigator && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      await navigator.share({
        url: `${window.location.origin}/u/${username}`,
        title: `Mes stats Spotify sur loopstat`,
      });
    } catch {
      /* user cancelled or share unsupported */
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_340px]">
      <div className="flex items-center justify-center rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(124,58,237,0.06),transparent_60%),repeating-linear-gradient(45deg,rgba(255,255,255,0.02)_0_8px,transparent_8px_16px)] p-6 min-h-[460px]">
        <Preview src={previewUrl} format={committedConfig.format} />
      </div>

      <div className="flex flex-col gap-5">
        <Group label="Mode">
          <Segmented
            options={SHARE_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            value={config.mode}
            onChange={(mode) => patch({ mode })}
          />
        </Group>

        {config.mode === "focus" ? (
          <Group label="Catégorie">
            <Segmented
              options={SHARE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
              value={config.type}
              onChange={(type) => patch({ type })}
            />
          </Group>
        ) : null}

        {config.mode === "focus" ? (
          <Group label="Top N">
            <Chips
              options={[3, 5, 7, 10].map((n) => ({
                value: n,
                label: String(n),
                disabled: !FORMAT_N_OPTIONS[config.format].includes(n),
              }))}
              value={config.n}
              onChange={(n) => patch({ n })}
            />
          </Group>
        ) : null}

        <Group label="Période">
          <Chips
            options={SHARE_PERIODS.map((p) => ({
              value: p,
              label: PERIOD_LABEL[p],
            }))}
            value={config.period}
            onChange={(period) => patch({ period })}
          />
        </Group>

        <Group label="Format">
          <Segmented
            options={SHARE_FORMATS.map((f) => ({
              value: f,
              label: FORMAT_LABEL[f],
            }))}
            value={config.format}
            onChange={(format) => patch({ format })}
          />
        </Group>

        <Group label="Background">
          <Segmented
            options={SHARE_BACKGROUNDS.map((b) => ({
              value: b,
              label: BG_LABEL[b],
            }))}
            value={config.bg}
            onChange={(bg) => patch({ bg })}
          />
        </Group>

        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          <a
            href={liveUrl}
            download={`loopstat-${username}-${config.format}.png`}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6d28d9]"
          >
            <Download className="size-4" /> Télécharger PNG
          </a>
          {canNativeShare ? (
            <button
              type="button"
              onClick={nativeShare}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm transition hover:bg-white/10"
            >
              <Share2 className="size-4" /> Partager via mon appareil
            </button>
          ) : null}
          <button
            type="button"
            onClick={copyEditorLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm transition hover:bg-white/10"
          >
            {copied ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            {copied ? "Lien copié !" : "Copier le lien de l'éditeur"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-white/8 bg-white/5 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm transition",
            opt.value === value
              ? "bg-[#7c3aed] text-white font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition",
            opt.value === value
              ? "border-[#7c3aed] bg-[#7c3aed] text-white"
              : "border-white/8 bg-white/5 text-muted-foreground hover:text-foreground",
            opt.disabled && "cursor-not-allowed opacity-30 hover:text-muted-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
