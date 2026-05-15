"use client";

import { useRef } from "react";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline image that opens fullscreen on click. Uses the native <dialog>
 * element so ESC and focus trapping work out of the box, no portal needed.
 */
export function ImageZoom({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={`Agrandir : ${alt}`}
        className={cn(
          "group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border bg-background",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block h-auto w-full" />
        <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <ZoomIn className="size-3.5" />
          Agrandir
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-label={alt}
        onClick={(e) => {
          // Clicking the backdrop (= the dialog element itself) closes it.
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto max-h-[92vh] max-w-[min(92vw,1400px)] rounded-2xl border bg-card p-0 text-foreground backdrop:bg-background/80 backdrop:backdrop-blur"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-2 backdrop-blur transition hover:bg-accent"
        >
          <X className="size-4" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block max-h-[92vh] w-full object-contain"
        />
      </dialog>
    </>
  );
}
