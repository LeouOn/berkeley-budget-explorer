import { useCallback, useSyncExternalStore } from "react";
import type { DollarMode } from "../query/engine";
import { parseOverviewUrl, serializeOverviewUrl } from "../query/url-state";

function subscribeToUrl(listener: () => void): () => void {
  window.addEventListener("popstate", listener);
  window.addEventListener("bbe:url-change", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("bbe:url-change", listener);
  };
}

function getUrlSnapshot(): string {
  return window.location.search;
}

function getServerSnapshot(): string {
  return "";
}

export interface OverviewUrlState {
  readonly mode: DollarMode;
  readonly baseYear: number;
  readonly setMode: (next: DollarMode) => void;
}

export function useOverviewUrlState(): OverviewUrlState {
  const search = useSyncExternalStore(subscribeToUrl, getUrlSnapshot, getServerSnapshot);
  const state = parseOverviewUrl(search);
  const setMode = useCallback(
    (next: DollarMode) => {
      const serialized = serializeOverviewUrl({ mode: next, baseYear: state.baseYear });
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${serialized}${window.location.hash}`,
      );
      window.dispatchEvent(new Event("bbe:url-change"));
    },
    [state.baseYear],
  );
  return { mode: state.mode, baseYear: state.baseYear, setMode };
}
