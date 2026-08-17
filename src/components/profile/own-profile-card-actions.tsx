"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { useIsClient } from "@/lib/use-is-client";

export function CopyProfileLinkButton({ username }: { username: string }) {
  const isClient = useIsClient();
  const [copied, setCopied] = useState(false);
  const origin = isClient ? window.location.origin : "https://loopstat.fr";
  const url = `${origin}/u/${username}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable on non-HTTPS — fail silently */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
    >
      {copied ? (
        <Check className="size-4" />
      ) : (
        <LinkIcon className="size-4" />
      )}
      {copied ? "Lien copié !" : "Copier le lien"}
    </button>
  );
}
