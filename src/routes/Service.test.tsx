import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Service } from "./Service";

const originalHash = window.location.hash;

describe("Service route", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/#/service/svc-public-safety");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", originalHash || "/#/");
  });

  it("renders the service title and description for a known service key", () => {
    render(<Service serviceKey="svc-public-safety" />);
    expect(screen.getByRole("heading", { name: /^public safety$/i })).toBeInTheDocument();
    expect(screen.getByText(/police, fire, and emergency response/i)).toBeInTheDocument();
  });

  it("renders the citywide expenditure trend with a chart and the disclosure note", () => {
    render(<Service serviceKey="svc-public-safety" />);
    expect(
      screen.getByRole("heading", { name: /citywide expenditure trend/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not publish a service-level expenditure series/i),
    ).toBeInTheDocument();
    const figure = document.querySelector("figure");
    expect(figure).not.toBeNull();
  });

  it("lists the related SCO expense categories for the service", () => {
    render(<Service serviceKey="svc-public-safety" />);
    expect(screen.getByRole("heading", { name: /what's in this service\?/i })).toBeInTheDocument();
    const categorySection = screen
      .getByRole("heading", { name: /what's in this service\?/i })
      .closest("section");
    if (!categorySection) throw new Error("Category section not rendered");
    expect(categorySection.textContent).toContain("Public Safety");
    expect(categorySection.textContent).toContain("General Government and Public Safety");
    expect(categorySection.textContent).toContain("ent-sco-cat-public-safety");
  });

  it("renders a compare-department link when the service has a primary department", () => {
    render(<Service serviceKey="svc-public-safety" />);
    const compareDept = screen.getByRole("link", {
      name: /compare the primary department/i,
    });
    expect(compareDept).toBeInTheDocument();
    const href = compareDept.getAttribute("href") ?? "";
    expect(href).toContain("entities=ent-socrata-dept-police");
    expect(href.startsWith("#/compare?entities=")).toBe(true);
  });

  it("renders the FY2017 schema break note in the 'What's not in this service' section", () => {
    render(<Service serviceKey="svc-public-safety" />);
    expect(
      screen.getByRole("heading", { name: /what's not in this service\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/SCO detailed expenditure schema changes materially in FY2017/i),
    ).toBeInTheDocument();
  });

  it("renders the FY2025 General Fund variance card on the general-government service", () => {
    render(<Service serviceKey="svc-general" />);
    expect(
      screen.getByRole("heading", { name: /adopted vs actual \(fy2025 general fund\)/i }),
    ).toBeInTheDocument();
    const openInCompare = screen.getByRole("link", { name: /open in compare/i });
    const href = openInCompare.getAttribute("href") ?? "";
    expect(href).toContain("entities=ent-budget-fy2025-general-fund-expenditure");
    expect(href).toContain("ent-acfr-general-fund-expenditure");
    expect(href).toContain("start=2025");
    expect(href).toContain("end=2025");
  });

  it("omits the variance card on services without general-fund mapping", () => {
    render(<Service serviceKey="svc-public-safety" />);
    expect(
      screen.queryByRole("heading", { name: /adopted vs actual \(fy2025 general fund\)/i }),
    ).toBeNull();
  });

  it("renders the not-found page for an unknown service key", () => {
    render(<Service serviceKey="svc-does-not-exist" />);
    expect(screen.getByRole("heading", { name: /service not found/i })).toBeInTheDocument();
    expect(screen.getByText(/no service matches the key/i)).toBeInTheDocument();
  });

  it("renders navigation links back to Overview, Compare, and Methodology", () => {
    render(<Service serviceKey="svc-public-safety" />);
    const nav = screen.getByRole("navigation", { name: /route navigation/i });
    expect(nav.querySelector('a[href="#/"]')).not.toBeNull();
    expect(nav.querySelector('a[href="#/compare"]')).not.toBeNull();
    expect(nav.querySelector('a[href="#/methodology"]')).not.toBeNull();
  });
});
