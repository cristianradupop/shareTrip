import { expect, test } from "@playwright/test";

// Smoke tests: no database, no real secrets. They prove the production build boots and the public
// surface and the auth redirects (server-admin/src/proxy.ts) behave. Deeper flows need a test database (see docs/adr).

test("landing page renders", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("login page renders the form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Username or email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("signup page renders", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
});

for (const path of [
  "/admin",
  "/organizer",
  "/admin/statistics",
  "/admin/trips",
  "/admin/activity",
  "/admin/account-history",
  "/admin/audit-log",
]) {
  test(`${path} without a session redirects to /login with a return path`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(path);
  });
}

test("/feed no longer exists: 404, no redirect to login", async ({ page }) => {
  const res = await page.goto("/feed");
  expect(res?.status()).toBe(404);
  expect(new URL(page.url()).pathname).toBe("/feed");
});

test("landing shows the trips section between the hero and About (error state without a DB)", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  const section = page.locator("section#trips");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading").first()).toBeVisible();
});

test("the About menu link brings the About heading into view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the menu links are hidden below the md breakpoint");
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: "About", exact: true }).click();
  await expect(page.getByRole("heading", { name: "About TripTogether" })).toBeInViewport();
});

test("/api/health is proxied to server-app and returns ok JSON", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("unknown route returns 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
});
