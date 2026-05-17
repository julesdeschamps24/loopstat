"use client";

import { useEffect, useState } from "react";

import type { ShareFormat } from "@/lib/share/card-config";

const ASPECT: Record<ShareFormat, string> = {
  twitter: "1200 / 630",
  post: "1 / 1",
  story: "9 / 16",
};

export function Preview({
  src,
  format,
}: {
  src: string;
  format: ShareFormat;
}) {
  // Display previous src while next one loads, so the editor never
  // shows a blank box mid-tweak.
  const [displaySrc, setDisplaySrc] = useState(src);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (src === displaySrc) return;
    // Image preload is external system sync: DOM Image API onload/onerror
    // callbacks require setState to swap the visible src when ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const img = new Image();
    img.onload = () => {
      setDisplaySrc(src);
      setLoading(false);
    };
    img.onerror = () => {
      setLoading(false);
    };
    img.src = src;
  }, [src, displaySrc]);

  return (
    <div
      style={{ aspectRatio: ASPECT[format] }}
      className="relative w-full max-w-[480px] max-h-[640px] overflow-hidden rounded-xl shadow-[0_30px_80px_rgba(124,58,237,0.25)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displaySrc}
        alt="Aperçu de la carte"
        className="h-full w-full object-cover"
      />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      ) : null}
    </div>
  );
}
