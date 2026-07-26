import { expect, test } from "@playwright/test";

const POST_2017_ENTITY = "ent-sco-cat-general-government-and-public-safety";
const POST_2017_ENTITY_2 = "ent-sco-cat-water-enterprise-fund";
const PRE_2017_ENTITY = "ent-sco-cat-public-safety";

test.describe("Compare route", () => {
  test("renders the workspace with entity picker and empty state", async ({ page }) => {
    await page.goto("/#/compare");
    await expect(page.getByRole("heading", { name: /budget comparison workspace/i })).toBeVisible();
    await expect(page.getByText(/no entities selected yet/i)).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeVisible();
  });

  test("selecting an entity updates the URL and renders the chart", async ({ page }) => {
    await page.goto("/#/compare");
    const firstCheckbox = page.getByRole("checkbox").first();
    await firstCheckbox.click();
    await expect(page).toHaveURL(/entities=/);
    await expect(page.locator("figure svg")).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("URL state round-trips: loading a URL with pre-selected entities shows the chart", async ({
    page,
  }) => {
    await page.goto(
      `/#/compare?entities=${POST_2017_ENTITY},${POST_2017_ENTITY_2}&start=2019&end=2024&mode=real&unit=absolute&baseYear=2024`,
    );
    await expect(page.locator("figure svg")).toBeVisible();
    await expect(page.getByRole("button", { name: /download csv/i })).toBeVisible();
  });

  test("toggles dollar mode via the radio group and updates the URL", async ({ page }) => {
    await page.goto(`/#/compare?entities=${POST_2017_ENTITY}&start=2019&end=2024`);
    await page.getByRole("radio", { name: /^nominal$/i }).click();
    await expect(page).toHaveURL(/mode=nominal/);
    await page.getByRole("radio", { name: /^real$/i }).click();
    await expect(page).toHaveURL(/mode=real/);
  });

  test("toggles unit via the radio group and updates the URL", async ({ page }) => {
    await page.goto(`/#/compare?entities=${POST_2017_ENTITY}&start=2019&end=2024`);
    await page.getByRole("radio", { name: /\/resident/i }).click();
    await expect(page).toHaveURL(/unit=per-resident/);
  });

  test("CSV download button triggers a file download", async ({ page }) => {
    await page.goto(`/#/compare?entities=${POST_2017_ENTITY}&start=2019&end=2024`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download csv/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".csv");
  });

  test("removing a selected entity via chip button updates the URL", async ({ page }) => {
    await page.goto(
      `/#/compare?entities=${POST_2017_ENTITY},${POST_2017_ENTITY_2}&start=2019&end=2024`,
    );
    const removeBtn = page.getByRole("button", {
      name: /remove general government and public safety/i,
    });
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();
    await expect(page).toHaveURL(new RegExp(`entities=${POST_2017_ENTITY_2}`));
  });

  test("enforces maximum of 4 selected entities", async ({ page }) => {
    await page.goto("/#/compare");
    const checkboxes = page.getByRole("checkbox");
    const count = await checkboxes.count();
    for (let i = 0; i < Math.min(4, count); i += 1) {
      await checkboxes.nth(i).click();
    }
    const disabledCount = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="checkbox"]');
      let disabled = 0;
      for (const inp of inputs) {
        if (inp instanceof HTMLInputElement && inp.disabled && !inp.checked) {
          disabled += 1;
        }
      }
      return disabled;
    });
    expect(disabledCount).toBeGreaterThan(0);
  });

  test("keyboard-only operation reaches a checkbox and selects it", async ({ page }) => {
    await page.goto("/#/compare");
    await page.keyboard.press("Tab");
    let safety = 40;
    while (safety > 0) {
      const focused = await page.evaluate(
        () =>
          (document.activeElement as HTMLElement | null)?.type ??
          (document.activeElement as HTMLElement | null)?.tagName ??
          "",
      );
      if (focused === "checkbox") break;
      await page.keyboard.press("Tab");
      safety -= 1;
    }
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/entities=/);
  });

  test("works at 320 CSS pixel width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/#/compare");
    await expect(page.getByRole("heading", { name: /budget comparison workspace/i })).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeVisible();
  });

  test("navigates to Overview via the nav link", async ({ page }) => {
    await page.goto("/#/compare");
    await page.getByRole("link", { name: /overview/i }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(
      page.getByRole("heading", { name: /city of berkeley at a glance/i }),
    ).toBeVisible();
  });

  test("Overview CTA navigates to Compare", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /compare budgets/i }).click();
    await expect(page).toHaveURL(/#\/compare/);
    await expect(page.getByRole("heading", { name: /budget comparison workspace/i })).toBeVisible();
  });

  test("renders the SCO schema change annotation in comparability notes", async ({ page }) => {
    await page.goto("/#/compare");
    await expect(page.getByText(/comparability notes/i)).toBeVisible();
    await expect(page.getByText(/SCO detailed expenditure schema changes/i)).toBeVisible();
  });

  test("pre-2017 categories show partial coverage in chart", async ({ page }) => {
    await page.goto(`/#/compare?entities=${PRE_2017_ENTITY}&start=2003&end=2024`);
    await expect(page.locator("figure svg")).toBeVisible();
    await expect(page.getByText(/approximate/i)).toBeVisible();
  });

  test("original-label mode toggles via the checkbox and updates the URL", async ({ page }) => {
    await page.goto(`/#/compare?entities=${POST_2017_ENTITY}&start=2019&end=2024`);
    const checkbox = page.getByRole("checkbox", { name: /show original source labels/i });
    await checkbox.check();
    await expect(page).toHaveURL(/originalLabels=1/);
    await checkbox.uncheck();
    await expect(page).toHaveURL(/[^l]$/);
  });

  test("original-label mode renders the source label next to the entity chip", async ({ page }) => {
    await page.goto(`/#/compare?entities=${POST_2017_ENTITY}&start=2019&end=2024&originalLabels=1`);
    await expect(page.getByText(/Berkeley/i).first()).toBeVisible();
    await expect(page.locator("figure svg")).toBeVisible();
  });

  test("citywide revenue vs expenditure are selectable from the Citywide totals group", async ({
    page,
  }) => {
    await page.goto(
      "/#/compare?entities=ent-citywide-revenue,ent-citywide-expenditure&start=2003&end=2024",
    );
    await expect(page.locator("figure svg")).toBeVisible();
    await expect(page.getByText(/Citywide Total Revenues/i).first()).toBeVisible();
    await expect(page.getByText(/Citywide Total Expenditures/i).first()).toBeVisible();
  });
});
