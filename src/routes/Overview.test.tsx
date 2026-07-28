import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Overview } from "./Overview";

const originalSearch = window.location.search;
const originalHash = window.location.hash;

afterEach(() => {
  cleanup();
});

describe("Overview route", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?mode=real&baseYear=2024");
  });

  afterEach(() => {
    window.history.replaceState(null, "", `${originalSearch}${originalHash}`);
  });

  it("renders the fiscal snapshot with the selected year", () => {
    render(<Overview />);
    expect(
      screen.getByRole("heading", { name: /city of berkeley at a glance/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/FY2024/i).length).toBeGreaterThan(0);
  });

  it("discloses that every value is a SCO standardized actual", () => {
    render(<Overview />);
    expect(screen.getAllByText(/standardized actual/i).length).toBeGreaterThan(0);
  });

  it("lists all manifest source ids in the citation footer", () => {
    render(<Overview />);
    const citations = screen.getAllByRole("listitem");
    const ids = citations.map((li) => li.textContent ?? "").filter((t) => t.includes("src-"));
    const sourceIds = [
      "src-bls-cpi-u-cuura422sa0",
      "src-berkeley-socrata-gy8t-iqc4",
      "src-sco-expenditures-ju3w-4gxp",
      "src-sco-expenditures-per-capita-ykhf-vfsr",
      "src-sco-revenues-per-capita-ky7j-fsk5",
      "src-acfr-fy2025",
      "src-budget-fy2025",
      "src-revenue-budget-fy2025",
    ];
    for (const id of sourceIds) {
      expect(ids.some((t) => t.includes(id))).toBe(true);
    }
  });

  it("switches dollar mode via the toggle and updates the URL", async () => {
    const user = userEvent.setup();
    render(<Overview />);
    await user.click(screen.getByRole("radio", { name: /nominal/i }));
    expect(window.location.search).toContain("mode=nominal");
  });

  it("renders the synchronized data table with at least one row", () => {
    render(<Overview />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(table.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });

  it("renders a compare-by-department link pre-populated with the top departments", () => {
    render(<Overview />);
    const link = screen.getByRole("link", { name: /compare police, fire, public works/i });
    expect(link).toBeInTheDocument();
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("entities=ent-socrata-dept-police");
    expect(href).toContain("ent-socrata-dept-fire");
    expect(href).toContain("ent-socrata-dept-public-works");
    expect(href).toContain("ent-socrata-dept-parks");
    expect(href.startsWith("#/compare?entities=")).toBe(true);
  });

  it("renders the curated insights section with at least one card", () => {
    render(<Overview />);
    expect(screen.getByRole("heading", { name: /curated insights/i })).toBeInTheDocument();
    const cards = screen.getAllByText(/Insight/i);
    expect(cards.length).toBeGreaterThan(0);
  });

  it("renders the schema reorganization insight body", () => {
    render(<Overview />);
    expect(screen.getByText(/categories before FY2017 became/)).toBeInTheDocument();
  });

  it("renders a Report a data issue link in the footer", () => {
    render(<Overview />);
    const link = screen.getByRole("link", { name: /report a data issue/i });
    expect(link).toBeInTheDocument();
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("mailto:data@berkeleyca.gov?")).toBe(true);
    expect(href).toContain("subject=Budget+Explorer+data+issue");
  });
});
