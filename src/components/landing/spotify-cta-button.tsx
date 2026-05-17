"use client";

import { useState } from "react";
import { startSpotifySignin } from "@/lib/auth/start-spotify-signin";

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.1a.75.75 0 1 1-.3-1.5c4.5-1 8.3-.6 11.4 1.3.4.2.5.7.3 1.05zm1.5-3.3a.94.94 0 0 1-1.3.3c-3.2-2-8.1-2.6-11.9-1.4a.94.94 0 1 1-.55-1.8c4.3-1.3 9.7-.7 13.4 1.6.4.3.6.9.4 1.3zm.1-3.5C15.5 8.3 8.7 8.05 5.1 9.15a1.13 1.13 0 1 1-.65-2.15c4.1-1.2 11.6-1 16 1.6a1.13 1.13 0 1 1-1.15 1.95z" />
    </svg>
  );
}

export function SpotifyCtaButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await startSpotifySignin("/dashboard");
    } catch (e) {
      console.error("signin failed", e);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleClick()}
      className="inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: "#1ed760", color: "#0a0a0a" }}
    >
      <SpotifyIcon />
      {loading ? "Redirection…" : "Continuer avec Spotify"}
    </button>
  );
}
