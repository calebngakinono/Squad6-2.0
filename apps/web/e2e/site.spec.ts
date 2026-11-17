import { expect, test } from "@playwright/test";

const pages = [
  { path: "/", heading: "Fitness accountability for squads of up to six" },
  { path: "/privacy", heading: "Privacy policy" },
  { path: "/terms", heading: "Terms of use" },
  { path: "/support", heading: "Support" },
] as const;

for (const { path, heading } of pages) {
  test(`${path} renders its main heading and footer`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("City data © GeoNames (geonames.org)");
    await expect(footer).toContainText("CC BY 4.0");
    await expect(footer).toContainText(String(new Date().getFullYear()));

    // Nothing scrolls sideways, including at phone width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

const footerLinks = [
  { name: "Privacy policy", path: "/privacy", heading: "Privacy policy" },
  { name: "Terms of use", path: "/terms", heading: "Terms of use" },
  { name: "Support", path: "/support", heading: "Support" },
] as const;

for (const link of footerLinks) {
  test(`footer link "${link.name}" opens ${link.path}`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: link.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${link.path}$`));
    await expect(page.getByRole("heading", { level: 1, name: link.heading })).toBeVisible();
  });
}

test("support page explains how to delete an account", async ({ page }) => {
  await page.goto("/support");
  await expect(page.getByRole("heading", { level: 2, name: "Delete your account" })).toBeVisible();
  await expect(page.getByText("Tap Delete account and confirm.")).toBeVisible();
});

test("landing page offers no download button yet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /app store|download/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Squad Six is coming to iPhone" })).toBeVisible();
});

test("main navigation reaches every page", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
});
