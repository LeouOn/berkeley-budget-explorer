import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const DARK_CANVAS = "rgb(26, 24, 21)";
const DARK_INK = "rgb(244, 239, 230)";

test.use({ colorScheme: "dark" });

test.describe("Dark mode (prefers-color-scheme: dark)", () => {
  test("Overview route has dark-mode CSS tokens applied", async ({ page }) => {
    await page.goto("/");
    const canvasToken = await page.evaluate(() => {
      const cs = window.getComputedStyle(document.documentElement);
      return cs.getPropertyValue("--color-canvas").trim();
    });
    expect(canvasToken.toLowerCase()).toBe("#1a1815");
  });

  test("Overview route renders dark-mode computed colors on the body", async ({ page }) => {
    await page.goto("/");
    const bgColor = await page.evaluate(() => {
      const cs = window.getComputedStyle(document.body);
      return cs.backgroundColor;
    });
    expect(bgColor.replace(/\s+/g, "")).toBe(DARK_CANVAS.replace(/\s+/g, ""));
  });

  test("Overview route has no serious or critical axe violations in dark mode", async ({
    page,
  }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("Compare route has no serious or critical axe violations in dark mode", async ({ page }) => {
    await page.goto("/#/compare");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("Quality route has no serious or critical axe violations in dark mode", async ({ page }) => {
    await page.goto("/#/quality");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("Methodology route has no serious or critical axe violations in dark mode", async ({
    page,
  }) => {
    await page.goto("/#/methodology");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("dark-mode ink token matches the expected high-contrast off-white", async ({ page }) => {
    await page.goto("/");
    const inkToken = await page.evaluate(() => {
      const cs = window.getComputedStyle(document.documentElement);
      return cs.getPropertyValue("--color-ink").trim().toLowerCase();
    });
    expect(inkToken).toBe("#f4efe6");
  });

  test("dark-mode ink token is used as the foreground color on the main heading", async ({
    page,
  }) => {
    await page.goto("/");
    const headingColor = await page
      .getByRole("heading", { name: /city of berkeley at a glance/i })
      .evaluate((el) => window.getComputedStyle(el).color);
    expect(headingColor.replace(/\s+/g, "")).toBe(DARK_INK.replace(/\s+/g, ""));
  });
});
