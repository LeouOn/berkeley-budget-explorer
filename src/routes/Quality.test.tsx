import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Quality } from "./Quality";

describe("Quality route", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the dashboard heading", () => {
    render(<Quality />);
    expect(screen.getByRole("heading", { name: /data quality dashboard/i })).toBeInTheDocument();
  });

  it("renders a release status section with pipeline status", () => {
    render(<Quality />);
    const releaseHeading = screen.getByRole("heading", { name: /release status/i });
    expect(releaseHeading).toBeInTheDocument();
    expect(screen.getAllByText("passed").length).toBeGreaterThan(0);
  });

  it("renders the source coverage table with at least one source row", () => {
    render(<Quality />);
    const coverageHeading = screen.getByRole("heading", {
      name: /source coverage by fiscal year/i,
    });
    expect(coverageHeading).toBeInTheDocument();
    const tables = screen.getAllByRole("table");
    expect(tables.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a Trend sparkline column in the coverage matrix", () => {
    render(<Quality />);
    const trendHeader = screen.getByRole("columnheader", { name: /^trend$/i });
    expect(trendHeader).toBeInTheDocument();
    const sparklines = document.querySelectorAll("[role='img']");
    expect(sparklines.length).toBeGreaterThan(0);
  });

  it("documents the sparkline caption under the coverage heading", () => {
    render(<Quality />);
    expect(screen.getByText(/values per fiscal year/i)).toBeInTheDocument();
  });

  it("renders the reconciliation table", () => {
    render(<Quality />);
    expect(screen.getByRole("heading", { name: /reconciliation results/i })).toBeInTheDocument();
  });

  it("renders the comparability breaks section with notes", () => {
    render(<Quality />);
    expect(screen.getByRole("heading", { name: /comparability breaks/i })).toBeInTheDocument();
    expect(screen.getByText(/socrata cohort stops at fy2015/i)).toBeInTheDocument();
  });

  it("renders the freshness table with retrieval dates", () => {
    render(<Quality />);
    expect(screen.getByRole("heading", { name: /data freshness/i })).toBeInTheDocument();
    expect(screen.getAllByText("2026-07-20").length).toBeGreaterThan(0);
  });

  it("renders navigation links to the other routes", () => {
    render(<Quality />);
    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /compare/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /methodology/i })).toBeInTheDocument();
  });

  it("shows the ACFR source id in the coverage matrix", () => {
    render(<Quality />);
    expect(screen.getAllByText(/src-acfr-fy2025/i).length).toBeGreaterThan(0);
  });

  it("renders the year-by-source presence matrix for FY2015-FY2025", () => {
    render(<Quality />);
    expect(screen.getByRole("heading", { name: /year-by-source presence/i })).toBeInTheDocument();
    const caption = screen.getByText(/rows are fiscal years FY2015-FY2025/i);
    expect(caption).toBeInTheDocument();
    expect(screen.getAllByText("FY2015").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FY2025").length).toBeGreaterThan(0);
  });

  it("renders presence check and cross marks in the presence matrix", () => {
    render(<Quality />);
    const checks = screen.getAllByText("✓");
    const crosses = screen.getAllByText("✗");
    expect(checks.length).toBeGreaterThan(0);
    expect(crosses.length).toBeGreaterThan(0);
  });

  it("renders the comparability gaps section with at least one gap group", () => {
    render(<Quality />);
    expect(screen.getByRole("heading", { name: /comparability gaps/i })).toBeInTheDocument();
    const gapCaption = screen.getByText(/Entities with partial year coverage/i);
    const table = gapCaption.closest("table");
    expect(table?.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });

  it("renders a Report a data issue link in the footer", () => {
    render(<Quality />);
    const link = screen.getByRole("link", { name: /report a data issue/i });
    expect(link).toBeInTheDocument();
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("mailto:data@berkeleyca.gov?")).toBe(true);
  });

  it("documents the FY2025 revenue sub-category comparability note", () => {
    render(<Quality />);
    expect(
      screen.getByText(/Revenue sub-category data is only available for FY2025/i),
    ).toBeInTheDocument();
  });

  it("lists the revenue-budget source in the coverage matrix", () => {
    render(<Quality />);
    expect(screen.getAllByText(/src-revenue-budget-fy2025/i).length).toBeGreaterThan(0);
  });
});
