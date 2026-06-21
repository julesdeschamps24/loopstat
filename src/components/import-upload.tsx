"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Upload } from "lucide-react";
import { ImportProgress } from "@/components/import-progress";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB — mirrors the route
const MAX_FILES = 30; // mirrors the route

// Seuls les fichiers `Streaming_History_Audio_*.json` contiennent des écoutes
// de tracks. Les `Streaming_History_Video_*.json` sont des podcasts/vidéos
// que le worker ignore, donc on les filtre côté client pour économiser le
// transfert et clarifier l'UX.
const AUDIO_FILENAME_RE = /^Streaming_History_Audio.*\.json$/i;

// Maps the route's machine error codes (POST /api/import, 400 branch) to
// user-facing French copy. Keep in sync with src/app/api/import/route.ts.
const ERROR_MESSAGES: Record<string, string> = {
  no_files: "Sélectionne au moins un fichier.",
  invalid_file_type: "Le fichier n'est pas un fichier .json.",
  file_too_large: "Le fichier dépasse la limite de 50 Mo.",
  too_many_files: "Trop de fichiers : 30 au maximum.",
};

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; importId: string }
  | { kind: "error"; message: string }
  | { kind: "expired" };

export function ImportUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function onFilesChange(list: FileList | null) {
    const all = list ? Array.from(list) : [];
    const audio = all.filter((f) => AUDIO_FILENAME_RE.test(f.name));
    setFiles(audio);
    setSkippedCount(all.length - audio.length);
    setStatus({ kind: "idle" });
  }

  function validate(selected: File[]): string | null {
    if (selected.length === 0) return "Sélectionne au moins un fichier.";
    if (selected.length > MAX_FILES) return "Trop de fichiers : 30 au maximum.";
    for (const file of selected) {
      if (!file.name.toLowerCase().endsWith(".json")) {
        return `« ${file.name} » n'est pas un fichier .json.`;
      }
      if (file.size > MAX_FILE_BYTES) {
        return `« ${file.name} » dépasse la limite de 50 Mo.`;
      }
    }
    return null;
  }

  async function onSubmit() {
    const validationError = validate(files);
    if (validationError) {
      setStatus({ kind: "error", message: validationError });
      return;
    }

    setStatus({ kind: "pending" });

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (res.status === 202) {
        const body = (await res.json().catch(() => null)) as
          | { importId?: string }
          | null;
        if (!body?.importId) {
          setStatus({
            kind: "error",
            message: "Réponse serveur invalide. Réessaie dans un instant.",
          });
          return;
        }
        setStatus({ kind: "success", importId: body.importId });
        setFiles([]);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      if (res.status === 401) {
        setStatus({ kind: "expired" });
        return;
      }

      if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; file?: string }
          | null;
        const base =
          (body?.error && ERROR_MESSAGES[body.error]) ?? "Fichiers invalides.";
        const message = body?.file ? `« ${body.file} » : ${base}` : base;
        setStatus({ kind: "error", message });
        return;
      }

      if (res.status === 429) {
        // Le serveur renvoie Retry-After en secondes (cf. rateLimitResponse).
        const retryAfterSec = Number(res.headers.get("Retry-After")) || 60;
        const minutes = Math.ceil(retryAfterSec / 60);
        const wait =
          retryAfterSec < 60
            ? `${retryAfterSec} secondes`
            : `${minutes} minute${minutes > 1 ? "s" : ""}`;
        setStatus({
          kind: "error",
          message: `Trop d'imports récents. Réessaie dans ~${wait}.`,
        });
        return;
      }

      setStatus({
        kind: "error",
        message: "L'import a échoué. Réessaie dans un instant.",
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Impossible de joindre le serveur. Vérifie ta connexion.",
      });
    }
  }

  const pending = status.kind === "pending";
  const invalid = status.kind === "error" || status.kind === "expired";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="import-files"
          className="block text-sm font-medium"
        >
          Fichiers d&apos;historique (.json)
        </label>
        <input
          ref={inputRef}
          id="import-files"
          type="file"
          multiple
          accept=".json"
          disabled={pending}
          aria-invalid={invalid}
          aria-describedby={invalid ? "import-status" : undefined}
          onChange={(e) => onFilesChange(e.target.files)}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border file:bg-card file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent file:transition disabled:opacity-50"
        />
        {files.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {files.length} fichier{files.length > 1 ? "s" : ""} Audio
            sélectionné{files.length > 1 ? "s" : ""}
          </p>
        ) : null}
        {skippedCount > 0 ? (
          <p className="text-xs text-amber-500">
            {skippedCount} fichier{skippedCount > 1 ? "s" : ""} ignoré
            {skippedCount > 1 ? "s" : ""} (seuls les{" "}
            <code>Streaming_History_Audio_*.json</code> sont utiles).
          </p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={pending || files.length === 0}
        onClick={() => void onSubmit()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Upload className="size-4" />
        {pending ? "Envoi en cours…" : "Lancer l'import"}
      </button>

      <div aria-live="polite">
        {status.kind === "error" ? (
          <p
            id="import-status"
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500"
          >
            {status.message}
          </p>
        ) : null}

        {status.kind === "expired" ? (
          <p
            id="import-status"
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500"
          >
            Session expirée, reconnecte-toi.{" "}
            <Link href="/connexion" className="font-medium underline">
              Se reconnecter
            </Link>
          </p>
        ) : null}

        {status.kind === "success" ? (
          <div
            data-import-id={status.importId}
            className="space-y-2 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm"
          >
            <p className="flex items-center gap-2 font-medium text-primary">
              <CheckCircle2 className="size-4" />
              Import lancé
            </p>
            <ImportProgress importId={status.importId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
