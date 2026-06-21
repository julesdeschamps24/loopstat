"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect.");
      } else if (result?.ok) {
        router.push("/dashboard");
      } else {
        setError("Email ou mot de passe incorrect.");
      }
    } catch {
      setError("Une erreur est survenue. Réessaie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="toi@exemple.com"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/30"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="login-password" className="block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="login-password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="Ton mot de passe"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/30"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>

      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex justify-center">
        <GoogleSignInButton />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-primary underline hover:opacity-80">
          S&apos;inscrire
        </Link>
      </p>
    </form>
  );
}
