"use client";

import { useSyncExternalStore } from "react";

const subscribe = (change: () => void) => {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
};

export function useDocumentVisible() {
  return useSyncExternalStore(subscribe, () => !document.hidden, () => true);
}
