import { expect, test } from "@playwright/test";

test.describe("Quality route", () => {
  test("renders the dashboard heading and coverage table", async ({ page }) => {
    await page.goto("/#/quality");
    await expect(page.getByRole("heading", { name: /data quality dashboard/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /source coverage by fiscal year/i }),
    ).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  test("lists all six source ids including ACFR FY2025", async ({ page }) => {
    await page.goto("/#/quality");
    await expect(page.getByText("src-acfr-fy2025").first()).toBeVisible();
    await expect(page.getByText("src-bls-cpi-u-cuura422sa0").first()).toBeVisible();
    await expect(page.getByText("src-sco-revenues-per-capita-ky7j-fsk5").first()).toBeVisible();
  });

  test("renders the reconciliation results table with passed status", async ({ page }) => {
    await page.goto("/#/quality");
    await expect(page.getByRole("heading", { name: /reconciliation results/i })).toBeVisible();
    await expect(page.getByText("passed").first()).toBeVisible();
  });

  test("renders the comparability breaks section", async ({ page }) => {
    await page.goto("/#/quality");
    await expect(page.getByRole("heading", { name: /comparability breaks/i })).toBeVisible();
    await expect(page.getByText(/socrata cohort stops at fy2015/i)).toBeVisible();
  });

  test("renders the data freshness table", async ({ page }) => {
    await page.goto("/#/quality");
    await expect(page.getByRole("heading", { name: /data freshness/i })).toBeVisible();
    await expect(page.getByText("2026-07-20").first()).toBeVisible();
  });

  test("works at 320 CSS pixel width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/#/quality");
    await expect(page.getByRole("heading", { name: /data quality dashboard/i })).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  test("navigates back to Overview via the nav link", async ({ page }) => {
    await page.goto("/#/quality");
    await page.getByRole("link", { name: /overview/i }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(
      page.getByRole("heading", { name: /city of berkeley at a glance/i }),
    ).toBeVisible();
  });
});
