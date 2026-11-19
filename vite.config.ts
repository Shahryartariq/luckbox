import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { GAMES } from "./src/shared/games.ts";

/**
 * The public address of the site. Every canonical link, Open Graph URL, sitemap
 * entry and structured-data URL comes from here. Override with VITE_SITE_URL.
 */
process.env.VITE_SITE_URL ??= "https://luckbox-kappa.vercel.app";
const SITE_URL = process.env.VITE_SITE_URL.replace(/\/$/, "");

const pages: Record<string, string> = {
  home: resolve(import.meta.dirname, "index.html"),
};
for (const game of GAMES) {
  pages[game.slug] = resolve(import.meta.dirname, game.slug, "index.html");
}

const AUTHOR = { "@type": "Person", name: "Muhammad Shehryar Tariq", url: "https://github.com/Shahryartariq" };

/** JSON-LD for a page: the site and its game list on the home page, the game and breadcrumbs elsewhere. */
function structuredData(slug: string | null): object[] {
  if (!slug) {
    return [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "luckbox",
        url: `${SITE_URL}/`,
        description: "Eight quick browser games, from pure luck to pure logic. Free, no sign-up.",
        inLanguage: "en",
        author: AUTHOR,
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "luckbox games",
        itemListElement: GAMES.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.name, url: `${SITE_URL}/${g.slug}/` })),
      },
    ];
  }
  const game = GAMES.find((g) => g.slug === slug);
  if (!game) return [];
  const url = `${SITE_URL}/${game.slug}/`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: game.name,
      url,
      description: game.blurb,
      image: `${SITE_URL}/og/${game.slug}.png`,
      applicationCategory: "GameApplication",
      gamePlatform: "Web browser",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
      inLanguage: "en",
      author: AUTHOR,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "luckbox", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: game.name, item: url },
      ],
    },
  ];
}

/** Adds structured data, font preloads, sitemap.xml and robots.txt to the build. */
function seo(): Plugin {
  return {
    name: "luckbox-seo",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const slug = /^\/([^/]+)\/index\.html$/.exec(ctx.path)?.[1] ?? null;
        const json = structuredData(slug)
          .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`)
          .join("\n    ");
        // Preload the three font files so text paints in the right font sooner.
        const fonts = Object.keys(ctx.bundle ?? {})
          .filter((f) => f.endsWith(".woff2"))
          .map((f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>`)
          .join("\n    ");
        return html.replace("</head>", `    ${fonts}\n    ${json}\n  </head>`);
      },
    },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const urls = ["", ...GAMES.map((g) => `${g.slug}/`)]
        .map((p) => `  <url><loc>${SITE_URL}/${p}</loc><lastmod>${today}</lastmod></url>`)
        .join("\n");
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [seo()],
  build: {
    target: "es2022",
    // One stylesheet for the whole site: fewer render-blocking requests, cached across pages.
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: { input: pages },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
