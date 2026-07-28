import { expect, test } from "@playwright/test";

test.describe("Overview route", () => {
  test("renders the fiscal snapshot, table, and chart with no network calls beyond the document", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (req) => requests.push(req.url()));
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /city of berkeley at a glance/i }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("figure svg")).toHaveCount(1);
    const offsite = requests.filter(
      (u) => !u.startsWith("http://localhost:4173") && !u.startsWith("data:"),
    );
    expect(offsite).toEqual([]);
  });

  test("toggles real to nominal and updates the URL", async ({ page }) => {
    await page.goto("/");
    const realTable = await page.locator("table").first().innerText();
    const nominal = page.getByRole("radio", { name: /nominal/i });
    await nominal.click();
    await expect(page).toHaveURL(/mode=nominal/);
    const nominalTable = await page.locator("table").first().innerText();
    expect(nominalTable).not.toBe(realTable);
    const real = page.getByRole("radio", { name: /real/i });
    await real.click();
    await expect(page).toHaveURL(/mode=real/);
    const realTableAgain = await page.locator("table").first().innerText();
    expect(realTableAgain).not.toBe(nominalTable);
  });

  test("citation footer lists every source manifest id (all eight)", async ({ page }) => {
    await page.goto("/");
    const citations = page.locator("section[aria-labelledby='sources-heading'] li");
    await expect(citations).toHaveCount(8);
  });

  test("Overview page discloses that values are SCO standardized actuals", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/standardized actual/i).first()).toBeVisible();
  });

  test("navigates to Methodology and back", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /methodology/i })
      .first()
      .click();
    await expect(page).toHaveURL(/#\/methodology/);
    await expect(page.getByRole("heading", { name: /methodology and sources/i })).toBeVisible();
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /city of berkeley at a glance/i }),
    ).toBeVisible();
  });

  test("works at 320 CSS pixel width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /city of berkeley at a glance/i }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("keyboard-only operation reaches the toggle", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    let safety = 30;
    while (safety > 0) {
      const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
      if (/real/i.test(focused)) break;
      await page.keyboard.press("Tab");
      safety -= 1;
    }
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/mode=nominal/);
  });

  test("Alt+number shortcuts route between Overview, Compare, Quality, Methodology", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Alt+2");
    await expect(page).toHaveURL(/#\/compare/);
    await page.keyboard.press("Alt+3");
    await expect(page).toHaveURL(/#\/quality/);
    await page.keyboard.press("Alt+4");
    await expect(page).toHaveURL(/#\/methodology/);
    await page.keyboard.press("Alt+1");
    await expect(page).toHaveURL(/#\/$/);
  });
});
