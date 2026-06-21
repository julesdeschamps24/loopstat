"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";
import { signUpAction, type SignUpState } from "@/app/inscription/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Création…" : "Créer mon compte"}
    </button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState<SignUpState, FormData>(
    signUpAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="signup-email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="toi@exemple.com"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/30"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="signup-password" className="block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="signup-password"
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="8 caractères minimum"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/30"
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <SubmitButton />

      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex justify-center">
        <GoogleSignInButton />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-primary underline hover:opacity-80">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
