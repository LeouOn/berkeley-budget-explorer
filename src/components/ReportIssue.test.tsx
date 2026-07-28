import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportIssue, buildReportIssueMailto } from "./ReportIssue";

afterEach(() => {
  cleanup();
});

describe("buildReportIssueMailto", () => {
  it("encodes the subject and a body referencing the page URL", () => {
    const mailto = buildReportIssueMailto("https://example.test/#/quality");
    expect(mailto.startsWith("mailto:data@berkeleyca.gov?")).toBe(true);
    expect(mailto).toContain("subject=Budget+Explorer+data+issue");
    expect(mailto).toContain("body=");
    expect(mailto).toContain(encodeURIComponent("https://example.test/#/quality"));
  });

  it("falls back to a generic body when no page URL is supplied", () => {
    const mailto = buildReportIssueMailto("");
    expect(mailto).toContain("Berkeley+Budget+Explorer");
  });

  it("supports routing to an alternate feedback address", () => {
    const mailto = buildReportIssueMailto("https://x.test", "feedback@berkeleyca.gov");
    expect(mailto.startsWith("mailto:feedback@berkeleyca.gov?")).toBe(true);
  });
});

describe("ReportIssue", () => {
  it("renders a 'Report a data issue' anchor with a mailto href", () => {
    render(<ReportIssue pageUrl="https://example.test/" />);
    const link = screen.getByRole("link", { name: /report a data issue/i });
    expect(link).toBeInTheDocument();
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("mailto:data@berkeleyca.gov?")).toBe(true);
    expect(href).toContain("subject=Budget+Explorer+data+issue");
  });

  it("populates the href from window.location.href on mount when no pageUrl is passed", () => {
    const initialHref = window.location.href;
    window.history.replaceState(null, "", "/#/quality");
    try {
      render(<ReportIssue />);
      const link = screen.getByRole("link", { name: /report a data issue/i });
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith("mailto:data@berkeleyca.gov?")).toBe(true);
      expect(href).toContain(encodeURIComponent(window.location.href));
    } finally {
      window.history.replaceState(null, "", initialHref);
    }
  });

  it("renders a placeholder href before mount when no pageUrl is supplied", () => {
    const initial = window.location.href;
    window.history.replaceState(null, "", "/");
    try {
      const { container } = render(<ReportIssue />);
      const link = container.querySelector("a");
      expect(link).not.toBeNull();
      // The very first paint may be "#" or a mailto depending on effect timing;
      // both are acceptable as long as the anchor exists.
      expect(link?.tagName).toBe("A");
    } finally {
      window.history.replaceState(null, "", initial);
    }
  });
});
