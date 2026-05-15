"use client";

import { useState } from "react";
import { cn, gradientCta } from "@/lib/utils";

export function SpotifyLoginButton() {
  const [loading, setLoading] = useState(false);

  async function startSignIn() {
    setLoading(true);
    try {
      // 1. Récupère le CSRF token (relatif → reste sur le host canonique).
      const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

      // 2. POST vers /api/auth/signin/spotify via un form submit. Le navigateur
      // suit le 302 vers Spotify en préservant les cookies.
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
    <button
      type="button"
      disabled={loading}
      onClick={() => void startSignIn()}
      className={cn(
        gradientCta,
        "w-full rounded-full px-6 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      {loading ? "Redirection vers Spotify…" : "Se connecter avec Spotify"}
    </button>
  );
}
