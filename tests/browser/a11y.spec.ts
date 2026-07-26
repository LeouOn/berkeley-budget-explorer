import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("WCAG 2.2 AA", () => {
  test("Overview route has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("Methodology route has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/#/methodology");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("Compare route has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/#/compare");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("Compare route with selections has no serious or critical axe violations", async ({
    page,
  }) => {
    await page.goto(
      "/#/compare?entities=ent-sco-cat-public-safety,ent-sco-cat-health&start=2019&end=2024&mode=real&unit=absolute",
    );
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("Quality route has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/#/quality");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
