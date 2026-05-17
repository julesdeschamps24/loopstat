"use client";

import { useState } from "react";
import { cn, gradientCta } from "@/lib/utils";
import { startSpotifySignin } from "@/lib/auth/start-spotify-signin";

export function SpotifyLoginButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
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
      onClick={() => void handleSignIn()}
      className={cn(
        gradientCta,
        "w-full rounded-full px-6 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      {loading ? "Redirection vers Spotify…" : "Se connecter avec Spotify"}
    </button>
  );
}
