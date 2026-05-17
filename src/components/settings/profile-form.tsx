"use client";

import { useActionState, useState } from "react";

import {
  type ProfileFormState,
  updateProfileAction,
} from "@/app/settings/actions";

type Props = {
  username: string;
  initialIsPublic: boolean;
};

const INITIAL: ProfileFormState = { status: "idle" };

export function ProfileForm({ username, initialIsPublic }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    INITIAL,
  );
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  // Si une collision a forcé un suffix au save, on affiche le pseudo réel.
  const displayUsername = state.status === "ok" ? state.username : username;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Pseudo</span>
        <div
          aria-readonly="true"
          className="rounded-lg border bg-card/40 px-3 py-2 font-mono text-sm text-muted-foreground/80"
        >
          {displayUsername}
        </div>
        <p className="text-xs text-muted-foreground">
          Dérivé de ton compte Spotify. Aperçu de l&apos;URL publique :{" "}
          <span className="font-mono">loopstat.tech/u/{displayUsername}</span>
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-lg border bg-card/60 p-3">
        <input
          name="isPublic"
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          disabled={isPending}
          className="mt-0.5 h-4 w-4 accent-[#7c3aed]"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium">Rendre mon profil public</span>
          <span className="text-xs text-muted-foreground">
            N&apos;importe qui pourra voir tes top tracks, artistes et albums
            sur <span className="font-mono">loopstat.tech/u/{displayUsername}</span>.
            Tu peux désactiver à tout moment.
          </span>
        </span>
      </label>

      {state.status === "error" ? (
        <p role="alert" className="text-xs text-red-500">
          {state.error}
        </p>
      ) : null}
      {state.status === "ok" ? (
        <p role="status" className="text-xs text-emerald-500">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-[#7c3aed] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
