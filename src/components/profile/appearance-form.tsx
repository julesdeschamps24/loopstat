"use client";

import { useActionState, useState } from "react";

import {
  type AppearanceFormState,
  updateAppearanceAction,
} from "@/app/settings/actions";
import { ProfilePreview } from "@/components/profile/profile-preview";
import {
  ACCENTS,
  ACCENT_HEX,
  BACKGROUNDS,
  BACKGROUND_LABELS,
  type Accent,
  type Background,
} from "@/lib/profile/appearance";

const INITIAL: AppearanceFormState = { status: "idle" };

export function AppearanceForm({
  username,
  displayName,
  initialBackground = "mesh",
  initialAccent = "violet",
}: {
  username: string;
  displayName: string;
  initialBackground?: Background;
  initialAccent?: Accent;
}) {
  const [state, formAction, isPending] = useActionState(
    updateAppearanceAction,
    INITIAL,
  );
  const [background, setBackground] = useState<Background>(initialBackground);
  const [accent, setAccent] = useState<Accent>(initialAccent);

  return (
    <form action={formAction} className="grid gap-6 sm:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Background
          </legend>
          <div className="flex flex-wrap gap-2">
            {BACKGROUNDS.map((b) => (
              <label key={b} className="cursor-pointer">
                <input
                  type="radio"
                  name="background"
                  value={b}
                  checked={background === b}
                  onChange={() => setBackground(b)}
                  className="peer sr-only"
                />
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition peer-checked:border-[#7c3aed] peer-checked:bg-[#7c3aed] peer-checked:text-white">
                  {BACKGROUND_LABELS[b]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Couleur d&apos;accent
          </legend>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <label key={a} className="cursor-pointer">
                <input
                  type="radio"
                  name="accent"
                  value={a}
                  checked={accent === a}
                  onChange={() => setAccent(a)}
                  className="peer sr-only"
                />
                <span
                  aria-label={a}
                  className="block size-9 rounded-full border-2 border-transparent transition peer-checked:border-white"
                  style={{ background: ACCENT_HEX[a] }}
                />
              </label>
            ))}
          </div>
        </fieldset>

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
          className="self-start rounded-full bg-[#7c3aed] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer l'apparence"}
        </button>
      </div>

      <div className="flex items-start justify-center">
        <ProfilePreview
          username={username}
          displayName={displayName}
          background={background}
          accent={accent}
        />
      </div>
    </form>
  );
}
