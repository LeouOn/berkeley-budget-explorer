import { expect, test } from "@playwright/test";

const POST_2017_ENTITY_A = "ent-sco-cat-general-government-and-public-safety";
const POST_2017_ENTITY_B = "ent-sco-cat-water-enterprise-fund";
const PRE_2017_ENTITY = "ent-sco-cat-public-safety";

test.describe("Compare chart legend and gap handling", () => {
  test("renders a legend listing each visible series by name", async ({ page }) => {
    await page.goto(
      `/#/compare?entities=${POST_2017_ENTITY_A},${POST_2017_ENTITY_B}&start=2019&end=2024`,
    );
    await expect(page.locator("figure svg")).toBeVisible();
    const legend = page.getByRole("list", { name: /chart legend/i });
    await expect(legend).toBeVisible();
    await expect(legend.getByText("General Government and Public Safety")).toBeVisible();
    await expect(legend.getByText("Water Enterprise Fund")).toBeVisible();
  });

  test("marks partial-coverage series with a partial coverage badge", async ({ page }) => {
    // Pre-2017 entity, only covers 2003-2017 inside the 2003-2024 range.
    await page.goto(`/#/compare?entities=${PRE_2017_ENTITY}&start=2003&end=2024`);
    await expect(page.locator("figure svg")).toBeVisible();
    const legend = page.getByRole("list", { name: /chart legend/i });
    await expect(legend.getByText(/partial coverage/i)).toBeVisible();
  });

  test("does not show partial-coverage badge for fully covered series", async ({ page }) => {
    await page.goto(`/#/compare?entities=${POST_2017_ENTITY_A}&start=2019&end=2024`);
    await expect(page.locator("figure svg")).toBeVisible();
    const legend = page.getByRole("list", { name: /chart legend/i });
    await expect(legend.getByText(/partial coverage/i)).toHaveCount(0);
  });
});

test.describe("Share link button", () => {
  test("Compare route shows a Copy share link button next to Download CSV", async ({ page }) => {
    await page.goto(
      `/#/compare?entities=${POST_2017_ENTITY_A},${POST_2017_ENTITY_B}&start=2019&end=2024`,
    );
    await expect(page.getByRole("button", { name: /download csv/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /copy share link/i })).toBeVisible();
  });

  test("clicking the Compare share button flips the label to Link copied!", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/#/compare?entities=${POST_2017_ENTITY_A}&start=2019&end=2024`);
    const shareBtn = page.getByRole("button", { name: /copy share link/i });
    await shareBtn.click();
    await expect(page.getByRole("button", { name: /link copied!/i })).toBeVisible();
  });

  test("Methodology route shows a Copy share link button and reports the copied status", async ({
    page,
  }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/#/methodology");
    const shareBtn = page.getByRole("button", { name: /copy share link/i });
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();
    await expect(page.getByRole("status").filter({ hasText: /share link copied/i })).toBeVisible();
  });
});

test.describe("Overview insight cards", () => {
  test("renders a Compare this link on the largest-real-growth insight", async ({ page }) => {
    await page.goto("/");
    const growthCard = page
      .locator("section", {
        has: page.getByRole("heading", { name: /curated insights/i }),
      })
      .getByRole("link", { name: /compare this/i });
    const count = await growthCard.count();
    expect(count).toBeGreaterThan(0);
  });
});
