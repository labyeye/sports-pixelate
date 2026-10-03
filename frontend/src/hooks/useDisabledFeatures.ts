import { useEffect, useSyncExternalStore } from "react";
import { settingsAPI } from "@/services/api";

// Tiny shared store so the sidebar, route guard and Settings page all see the
// same list without a provider. Loaded once per session once authenticated.
let disabled: string[] = [];
let loaded = false;
let loading = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function setDisabledFeatures(list: string[]) {
  disabled = list;
  loaded = true;
  emit();
}

export function resetDisabledFeatures() {
  disabled = [];
  loaded = false;
  emit();
}

export function useDisabledFeatures(enabled: boolean): string[] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => disabled,
  );

  useEffect(() => {
    if (!enabled || loaded || loading) return;
    loading = true;
    settingsAPI
      .get()
      .then((res) => setDisabledFeatures(res.data?.disabledFeatures || []))
      .catch(() => {})
      .finally(() => {
        loading = false;
      });
  }, [enabled]);

  return value;
}
