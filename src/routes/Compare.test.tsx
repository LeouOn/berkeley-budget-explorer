import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Compare } from "./Compare";

const originalHash = window.location.hash;

describe("Compare route", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/#/compare");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", originalHash || "/#/");
  });

  it("renders the comparison workspace heading", () => {
    render(<Compare />);
    expect(
      screen.getByRole("heading", { name: /budget comparison workspace/i }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when no entities are selected", () => {
    render(<Compare />);
    expect(screen.getByText(/no entities selected yet/i)).toBeInTheDocument();
  });

  it("lists available entities in the picker", () => {
    render(<Compare />);
    expect(screen.getByText(/Available entities/i)).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("selects an entity and shows it as a chip with the chart", async () => {
    const user = userEvent.setup();
    render(<Compare />);
    const firstCheckbox = screen.getAllByRole("checkbox")[0];
    if (!firstCheckbox) throw new Error("No checkbox found");
    await user.click(firstCheckbox);
    expect(window.location.hash).toContain("entities=");
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
  });

  it("toggles dollar mode between real and nominal via the URL", async () => {
    const user = userEvent.setup();
    render(<Compare />);
    const nominalBtn = screen.getByRole("radio", { name: /^nominal$/i });
    await user.click(nominalBtn);
    expect(window.location.hash).toContain("mode=nominal");
    const realBtn = screen.getByRole("radio", { name: /^real$/i });
    await user.click(realBtn);
    expect(window.location.hash).toContain("mode=real");
  });

  it("toggles unit to per-resident via the URL", async () => {
    const user = userEvent.setup();
    render(<Compare />);
    const perResidentBtn = screen.getByRole("radio", { name: /\/resident/i });
    await user.click(perResidentBtn);
    expect(window.location.hash).toContain("unit=per-resident");
  });

  it("renders the comparability notes panel", () => {
    render(<Compare />);
    expect(screen.getByText(/comparability notes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/FY2017/i).length).toBeGreaterThan(0);
  });

  it("renders navigation links to Overview and Methodology", () => {
    render(<Compare />);
    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /methodology/i })).toBeInTheDocument();
  });

  it("enforces a maximum of 4 selected entities", async () => {
    const user = userEvent.setup();
    render(<Compare />);
    const checkboxes = screen.getAllByRole("checkbox");
    for (let i = 0; i < 4 && i < checkboxes.length; i += 1) {
      const cb = checkboxes[i];
      if (cb) await user.click(cb);
    }
    const allBoxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    const checked = allBoxes.filter((cb) => cb.checked);
    expect(checked.length).toBeLessThanOrEqual(4);
    const disabled = allBoxes.filter((cb) => cb.disabled && !cb.checked);
    expect(disabled.length).toBeGreaterThan(0);
  });
});
