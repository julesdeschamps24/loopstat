"use client";

import { useState, useEffect } from "react";

export function SpotifyLoginButton() {
  const [loading, setLoading] = useState(false);
  const [host, setHost] = useState<string>("…");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hostname === "localhost") {
      window.location.replace(
        window.location.href.replace("//localhost", "//127.0.0.1"),
      );
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(window.location.host);
  }, []);

  const isOk = host === "127.0.0.1:3000";

  async function startSignIn() {
    setLoading(true);
    try {
      // 1. Récupère le CSRF token (URL relative → utilise 127.0.0.1)
      const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

      // 2. POST direct vers /api/auth/signin/spotify avec un vrai form submit
      // Le navigateur suit le 302 et préserve cookies + redirect vers Spotify
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/signin/spotify";

      const csrfInput = document.createElement("input");
      csrfInput.type = "hidden";
      csrfInput.name = "csrfToken";
      csrfInput.value = csrfToken;
      form.appendChild(csrfInput);

      const cbInput = document.createElement("input");
      cbInput.type = "hidden";
      cbInput.name = "callbackUrl";
      cbInput.value = `${window.location.origin}/dashboard`;
      form.appendChild(cbInput);

      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      console.error("signin failed", e);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`text-xs px-3 py-2 rounded-lg border ${
          isOk
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-red-500/10 border-red-500/30 text-red-500"
        }`}
      >
        Host actuel : <strong>{host}</strong>{" "}
        {isOk ? "✓" : "← doit être 127.0.0.1:3000 !"}
      </div>
      <button
        type="button"
        disabled={loading || !isOk}
        onClick={() => {
          if (window.location.hostname !== "127.0.0.1") {
            window.location.replace(
              window.location.href.replace(window.location.hostname, "127.0.0.1"),
            );
            return;
          }
          void startSignIn();
        }}
        className="w-full rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "Redirection vers Spotify…"
          : isOk
            ? "Se connecter avec Spotify"
            : "Bascule sur 127.0.0.1 d'abord"}
      </button>
    </div>
  );
}
