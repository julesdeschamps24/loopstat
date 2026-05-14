"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB — mirrors the route

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; importId: string }
  | { kind: "error"; message: string }
  | { kind: "expired" };

export function ImportUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function onFilesChange(list: FileList | null) {
    setFiles(list ? Array.from(list) : []);
    setStatus({ kind: "idle" });
  }

  function validate(selected: File[]): string | null {
    if (selected.length === 0) return "Sélectionne au moins un fichier.";
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
        const { importId } = (await res.json()) as { importId: string };
        setStatus({ kind: "success", importId });
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
        const message = body?.error
          ? body.file
            ? `${body.error} (${body.file})`
            : body.error
          : "Fichiers invalides.";
        setStatus({ kind: "error", message });
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
          onChange={(e) => onFilesChange(e.target.files)}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border file:bg-card file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent file:transition disabled:opacity-50"
        />
        {files.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {files.length} fichier{files.length > 1 ? "s" : ""} sélectionné
            {files.length > 1 ? "s" : ""}
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

      {status.kind === "error" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {status.message}
        </p>
      ) : null}

      {status.kind === "expired" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          Session expirée, reconnecte-toi.{" "}
          <Link href="/login" className="font-medium underline">
            Se reconnecter
          </Link>
        </p>
      ) : null}

      {status.kind === "success" ? (
        <div
          // data-import-id : seam pour le suivi de progression (tâche 4)
          data-import-id={status.importId}
          className={cn(
            "rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm",
          )}
        >
          <p className="flex items-center gap-2 font-medium text-primary">
            <CheckCircle2 className="size-4" />
            Import lancé
          </p>
          <p className="mt-1 text-muted-foreground">
            Identifiant :{" "}
            <code className="break-all text-foreground">
              {status.importId}
            </code>
          </p>
          <p className="mt-1 text-muted-foreground">
            Le traitement se fait en arrière-plan. Le suivi de progression
            arrive bientôt.
          </p>
        </div>
      ) : null}
    </div>
  );
}
