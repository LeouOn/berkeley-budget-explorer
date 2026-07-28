import { useCallback, useEffect, useRef, useState } from "react";

export type PermalinkStatus = "idle" | "copied" | "unsupported";

export interface PermalinkController {
  readonly status: PermalinkStatus;
  readonly label: string;
  readonly copy: () => Promise<void>;
}

export const PERMALINK_IDLE_LABEL = "Copy share link";
export const PERMALINK_COPIED_LABEL = "Link copied!";
export const PERMALINK_UNSUPPORTED_LABEL = "Copy unavailable";
const COPIED_FEEDBACK_MS = 2000;

// Reads the URL the user can actually share: hash + search, anchored to the
// current origin so absolute URLs come out stable across hosts.
function currentShareableUrl(): string {
  return `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
}

// Hidden textarea fallback used when `navigator.clipboard` is unavailable
// (insecure context, older browser). Returns true on success.
function legacyCopyViaTextarea(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export async function copyUrlToClipboard(
  url: string,
  navigatorApi: Navigator = navigator,
): Promise<boolean> {
  const clip = navigatorApi.clipboard;
  if (clip && typeof clip.writeText === "function") {
    try {
      await clip.writeText(url);
      return true;
    } catch {
      // Fall through to legacy path; the secure-context promise can reject
      // when the document is not focused or permissions are denied.
    }
  }
  return legacyCopyViaTextarea(url);
}

export interface UsePermalinkOptions {
  readonly feedbackMs?: number;
  readonly buildUrl?: () => string;
}

export function usePermalink(options: UsePermalinkOptions = {}): PermalinkController {
  const feedbackMs = options.feedbackMs ?? COPIED_FEEDBACK_MS;
  const buildUrl = options.buildUrl ?? currentShareableUrl;
  const [status, setStatus] = useState<PermalinkStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const label =
    status === "copied"
      ? PERMALINK_COPIED_LABEL
      : status === "unsupported"
        ? PERMALINK_UNSUPPORTED_LABEL
        : PERMALINK_IDLE_LABEL;

  const copy = useCallback(async () => {
    const url = buildUrl();
    const ok = await copyUrlToClipboard(url);
    if (!ok) {
      setStatus("unsupported");
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
      resetTimer.current = window.setTimeout(() => setStatus("idle"), feedbackMs);
      return;
    }
    setStatus("copied");
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }
    resetTimer.current = window.setTimeout(() => setStatus("idle"), feedbackMs);
  }, [buildUrl, feedbackMs]);

  return { status, label, copy };
}
