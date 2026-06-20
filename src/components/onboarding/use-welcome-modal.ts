"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "loopstat-welcome-shown";

// Registre d'abonnés au niveau module pour que `close()` puisse notifier le
// hook de relire localStorage (useSyncExternalStore rejoue getSnapshot à l'emit).
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) !== "true";
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Détermine si la modal de bienvenue doit s'afficher au premier load après
 * auth pour un user en mode démo. Lit localStorage via `useSyncExternalStore`
 * pour éviter de la ré-afficher au refresh (et éviter un setState dans un effect).
 *
 * Retourne :
 *  - `isOpen` : false au SSR/hydratation, devient true côté client si le flag
 *    est absent du localStorage
 *  - `close()` : ferme la modal et persiste le flag
 */
export function useWelcomeModalState(): {
  isOpen: boolean;
  close: () => void;
} {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const close = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    for (const listener of listeners) listener();
  }, []);

  return { isOpen, close };
}
