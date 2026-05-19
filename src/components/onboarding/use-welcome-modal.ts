"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "loopstat-welcome-shown";

/**
 * Détermine si la modal de bienvenue doit s'afficher au premier load après
 * auth pour un user en mode démo. Utilise localStorage pour éviter de
 * la ré-afficher au refresh.
 *
 * Retourne :
 *  - `isOpen` : true tant qu'on ne ferme pas (initial false, devient true
 *    au mount si flag absent du localStorage)
 *  - `close()` : ferme la modal et persiste le flag
 */
export function useWelcomeModalState(): {
  isOpen: boolean;
  close: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) !== "true") {
      setIsOpen(true);
    }
  }, []);

  const close = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsOpen(false);
  }, []);

  return { isOpen, close };
}
