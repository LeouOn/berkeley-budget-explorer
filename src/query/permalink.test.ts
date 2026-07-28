import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PERMALINK_COPIED_LABEL,
  PERMALINK_IDLE_LABEL,
  PERMALINK_UNSUPPORTED_LABEL,
  copyUrlToClipboard,
  usePermalink,
} from "./permalink";

type ClipboardLike = { writeText: (text: string) => Promise<void> };

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");

function installClipboard(value: ClipboardLike | undefined): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });
}

function installExecCommand(fn: ((cmd: string) => boolean) | undefined): void {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: fn,
  });
}

function restoreClipboard(): void {
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    installClipboard(undefined);
  }
}

function restoreExecCommand(): void {
  if (originalExecCommand) {
    Object.defineProperty(document, "execCommand", originalExecCommand);
  } else {
    installExecCommand(undefined);
  }
}

beforeEach(() => {
  installClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
  installExecCommand(vi.fn().mockReturnValue(true));
});

afterEach(() => {
  restoreClipboard();
  restoreExecCommand();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("copyUrlToClipboard", () => {
  it("uses navigator.clipboard.writeText when available", async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    installClipboard({ writeText: writeSpy });
    const ok = await copyUrlToClipboard("https://example.test/#/compare?entities=ent-x");
    expect(ok).toBe(true);
    expect(writeSpy).toHaveBeenCalledWith("https://example.test/#/compare?entities=ent-x");
  });

  it("falls back to the textarea path when clipboard API is missing", async () => {
    installClipboard(undefined);
    const execSpy = vi.fn().mockReturnValue(true);
    installExecCommand(execSpy);
    const ok = await copyUrlToClipboard("https://example.test/#/methodology");
    expect(ok).toBe(true);
    expect(execSpy).toHaveBeenCalledWith("copy");
  });

  it("returns false when both clipboard and legacy fallback fail", async () => {
    installClipboard(undefined);
    installExecCommand(
      vi.fn(() => {
        throw new Error("blocked");
      }),
    );
    const ok = await copyUrlToClipboard("https://example.test/");
    expect(ok).toBe(false);
  });
});

describe("usePermalink", () => {
  it("starts in the idle label and copies the built URL via the hook", async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    installClipboard({ writeText: writeSpy });
    const { result } = renderHook(() =>
      usePermalink({ buildUrl: () => "https://share.test/#/compare?entities=ent-y" }),
    );
    expect(result.current.label).toBe(PERMALINK_IDLE_LABEL);
    await act(async () => {
      await result.current.copy();
    });
    expect(writeSpy).toHaveBeenCalledWith("https://share.test/#/compare?entities=ent-y");
    expect(result.current.label).toBe(PERMALINK_COPIED_LABEL);
  });

  it("reverts to idle after the feedback window elapses", async () => {
    vi.useFakeTimers();
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    installClipboard({ writeText: writeSpy });
    const { result } = renderHook(() =>
      usePermalink({ buildUrl: () => "https://share.test/", feedbackMs: 100 }),
    );
    await act(async () => {
      await result.current.copy();
    });
    expect(result.current.label).toBe(PERMALINK_COPIED_LABEL);
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.label).toBe(PERMALINK_IDLE_LABEL);
  });

  it("exposes an unsupported status when the clipboard and fallback both fail", async () => {
    vi.useFakeTimers();
    installClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    installExecCommand(
      vi.fn(() => {
        throw new Error("blocked");
      }),
    );
    const { result } = renderHook(() =>
      usePermalink({ buildUrl: () => "https://share.test/", feedbackMs: 100 }),
    );
    await act(async () => {
      await result.current.copy();
    });
    expect(result.current.label).toBe(PERMALINK_UNSUPPORTED_LABEL);
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.label).toBe(PERMALINK_IDLE_LABEL);
  });
});
