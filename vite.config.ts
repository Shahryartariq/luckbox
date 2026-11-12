import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { GAMES } from "./src/shared/games.ts";

const pages: Record<string, string> = {
  home: resolve(import.meta.dirname, "index.html"),
};
for (const game of GAMES) {
  pages[game.slug] = resolve(import.meta.dirname, game.slug, "index.html");
}

export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: { input: pages },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
