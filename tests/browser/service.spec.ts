import { expect, test } from "@playwright/test";

test.describe("Service route", () => {
  test("renders the service detail page with trend, categories, and schema-break note", async ({
    page,
  }) => {
    await page.goto("/#/service/svc-public-safety");
    await expect(page.getByRole("heading", { name: /^public safety$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /citywide expenditure trend/i })).toBeVisible();
    await expect(page.locator("figure svg")).toBeVisible();
    await expect(page.getByRole("heading", { name: /what's in this service\?/i })).toBeVisible();
    await expect(page.getByText("ent-sco-cat-public-safety")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /what's not in this service\?/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/SCO detailed expenditure schema changes materially in FY2017/i),
    ).toBeVisible();
  });

  test("renders the FY2025 General Fund variance card on the general-government service", async ({
    page,
  }) => {
    await page.goto("/#/service/svc-general");
    await expect(
      page.getByRole("heading", { name: /adopted vs actual \(fy2025 general fund\)/i }),
    ).toBeVisible();
    const openInCompare = page.getByRole("link", { name: /open in compare/i });
    await expect(openInCompare).toBeVisible();
    const href = await openInCompare.getAttribute("href");
    expect(href).toContain("entities=ent-budget-fy2025-general-fund-expenditure");
    expect(href).toContain("ent-acfr-general-fund-expenditure");
    expect(href).toContain("start=2025");
    expect(href).toContain("end=2025");
  });

  test("omits the variance card on services without general-fund mapping", async ({ page }) => {
    await page.goto("/#/service/svc-public-safety");
    await expect(
      page.getByRole("heading", { name: /adopted vs actual \(fy2025 general fund\)/i }),
    ).toHaveCount(0);
  });

  test("renders the not-found page for an unknown service key", async ({ page }) => {
    await page.goto("/#/service/svc-does-not-exist");
    await expect(page.getByRole("heading", { name: /service not found/i })).toBeVisible();
  });

  test("service detail link from Overview card navigates to the service page", async ({ page }) => {
    await page.goto("/");
    const publicSafetyLink = page.getByRole("link", {
      name: /open public safety service detail/i,
    });
    await expect(publicSafetyLink).toBeVisible();
    await publicSafetyLink.click();
    await expect(page).toHaveURL(/#\/service\/svc-public-safety/);
    await expect(page.getByRole("heading", { name: /^public safety$/i })).toBeVisible();
  });

  test("compare-department link on the service page pre-fills Compare", async ({ page }) => {
    await page.goto("/#/service/svc-public-safety");
    const compareDept = page.getByRole("link", {
      name: /compare the primary department/i,
    });
    await expect(compareDept).toBeVisible();
    await compareDept.click();
    await expect(page).toHaveURL(/#\/compare/);
    await expect(page.url()).toContain("entities=ent-socrata-dept-police");
  });

  test("citywide revenue context section links to Compare", async ({ page }) => {
    await page.goto("/");
    const revenueLink = page.getByRole("link", {
      name: /compare citywide revenue vs expenditure/i,
    });
    await expect(revenueLink).toBeVisible();
    await revenueLink.click();
    await expect(page).toHaveURL(/entities=ent-citywide-revenue,ent-citywide-expenditure/);
  });

  test("has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/#/service/svc-public-safety");
    const AxeBuilder = (await import("@axe-core/playwright")).default;
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("works at 320 CSS pixel width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/#/service/svc-public-safety");
    await expect(page.getByRole("heading", { name: /^public safety$/i })).toBeVisible();
    await expect(page.locator("figure svg")).toBeVisible();
  });
});
