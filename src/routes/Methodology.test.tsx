import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Methodology } from "./Methodology";

describe("Methodology route", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the methodology and sources heading", () => {
    render(<Methodology />);
    expect(screen.getByRole("heading", { name: /methodology and sources/i })).toBeInTheDocument();
  });

  it("renders a Report a data issue link in the footer", () => {
    render(<Methodology />);
    const link = screen.getByRole("link", { name: /report a data issue/i });
    expect(link).toBeInTheDocument();
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("mailto:data@berkeleyca.gov?")).toBe(true);
    expect(href).toContain("subject=Budget+Explorer+data+issue");
  });

  it("lists every pinned source id in the Phase 1 sources section", () => {
    render(<Methodology />);
    const cards = screen.getAllByText(/src-revenue-budget-fy2025/i);
    expect(cards.length).toBeGreaterThan(0);
  });
});
