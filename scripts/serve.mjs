// Serves dist/ the way Vercel does for this project: headers from vercel.json,
// trailing-slash redirects, folder index.html files and the custom 404 page.
// Browser tests run against this so CSP and header problems show up before deploy.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(import.meta.dirname, "..", "dist");
const port = Number(process.env.PORT ?? 4173);
const config = JSON.parse(readFileSync(join(import.meta.dirname, "..", "vercel.json"), "utf8"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

/** Turns a Vercel source pattern like "/assets/(.*)" into a RegExp. */
const toRegExp = (source) => new RegExp(`^${source.replace(/\(\.\*\)/g, ".*")}$`);
const rules = (config.headers ?? []).map((r) => ({ re: toRegExp(r.source), headers: r.headers }));

function headersFor(path) {
  const out = {};
  for (const rule of rules) if (rule.re.test(path)) for (const h of rule.headers) out[h.key] = h.value;
  return out;
}

function send(res, status, file, path) {
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", ...headersFor(path) });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = decodeURIComponent(url.pathname);
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, safe);
  if (!file.startsWith(root)) {
    res.writeHead(400).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) {
      res.writeHead(308, { Location: `${path}/${url.search}`, ...headersFor(path) }).end();
      return;
    }
    file = join(file, "index.html");
  } else if (config.trailingSlash && !extname(path) && !path.endsWith("/") && existsSync(join(file, "index.html"))) {
    res.writeHead(308, { Location: `${path}/${url.search}` }).end();
    return;
  }
  if (existsSync(file) && statSync(file).isFile()) send(res, 200, file, path);
  else send(res, 404, join(root, "404.html"), path);
}).listen(port, () => console.warn(`Serving dist/ like Vercel on http://localhost:${port}`));
