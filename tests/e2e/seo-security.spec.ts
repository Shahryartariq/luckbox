import { expect, test } from "@playwright/test";
import { GAME_PATHS } from "./helpers";

const SITE = "https://luckbox-kappa.vercel.app";

test("security headers are set on every page", async ({ request }) => {
  for (const path of ["/", ...GAME_PATHS]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["cross-origin-resource-policy"]).toBe("same-origin");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
  }
});

test("no page breaks the content security policy", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { cspViolations: string[] }).cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  for (const path of ["/", ...GAME_PATHS]) {
    await page.goto(path);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations), path).toEqual([]);
  }
});

test("unknown pages return 404 and folders redirect to the trailing slash", async ({ request }) => {
  const missing = await request.get("/no-such-page/");
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("No luck");
  const noSlash = await request.get("/blackjack", { maxRedirects: 0 });
  expect(noSlash.status()).toBe(308);
  expect(noSlash.headers()["location"]).toBe("/blackjack/");
});

test("every page has a canonical URL, social image and structured data", async ({ page, request }) => {
  for (const path of ["/", ...GAME_PATHS]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}${path}`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${SITE}${path}`);
    const image = (await page.locator('meta[property="og:image"]').getAttribute("content")) ?? "";
    expect(image.startsWith(SITE)).toBe(true);
    expect((await request.get(image.replace(SITE, ""))).status()).toBe(200);
    const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) =>
      els.map((e) => (JSON.parse(e.textContent ?? "{}") as { "@type": string })["@type"]),
    );
    expect(types).toEqual(path === "/" ? ["WebSite", "ItemList"] : ["VideoGame", "BreadcrumbList"]);
    const title = await page.title();
    expect(title.length).toBeLessThanOrEqual(60);
    expect((await page.locator('meta[name="description"]').getAttribute("content"))?.length).toBeGreaterThan(50);
  }
});

test("sitemap, robots and manifest are valid", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/", ...GAME_PATHS]) expect(sitemap).toContain(`<loc>${SITE}${path}</loc>`);
  expect(sitemap).toContain("<lastmod>");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("luckbox");
  for (const icon of manifest.icons as { src: string }[]) expect((await request.get(icon.src)).status()).toBe(200);
});
