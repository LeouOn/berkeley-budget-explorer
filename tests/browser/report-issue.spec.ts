import { expect, test } from "@playwright/test";

const REPORT_LINK_NAME = /report a data issue/i;

test.describe("Report a data issue footer link", () => {
  test("appears on the Overview footer with a mailto href", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: REPORT_LINK_NAME });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^mailto:data@berkeleyca\.gov\?/);
    expect(href).toContain("subject=Budget+Explorer+data+issue");
    expect(href).toContain(encodeURIComponent("http://localhost:4173/"));
  });

  test("appears on the Compare footer with a mailto href", async ({ page }) => {
    await page.goto("/#/compare");
    const link = page.getByRole("link", { name: REPORT_LINK_NAME });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^mailto:data@berkeleyca\.gov\?/);
  });

  test("appears on the Quality footer with a mailto href", async ({ page }) => {
    await page.goto("/#/quality");
    const link = page.getByRole("link", { name: REPORT_LINK_NAME });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^mailto:data@berkeleyca\.gov\?/);
  });

  test("appears on the Methodology footer with a mailto href", async ({ page }) => {
    await page.goto("/#/methodology");
    const link = page.getByRole("link", { name: REPORT_LINK_NAME });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^mailto:data@berkeleyca\.gov\?/);
  });

  test("appears on the Service footer with a mailto href", async ({ page }) => {
    await page.goto("/#/service/svc-public-safety");
    const link = page.getByRole("link", { name: REPORT_LINK_NAME });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^mailto:data@berkeleyca\.gov\?/);
    expect(href).toContain(encodeURIComponent("#/service/svc-public-safety"));
  });
});
