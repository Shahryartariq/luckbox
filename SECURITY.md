# Security

luckbox is a static site with no server code, accounts or network calls. Game data stays in your browser's `localStorage`.

## What protects it

- A strict Content Security Policy: scripts, styles, fonts and images from the site only, no inline scripts or styles, no plugins, no framing
- HSTS, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Content-Type-Options`, `Referrer-Policy` and a locked-down `Permissions-Policy` (see `vercel.json`)
- Saved game data is treated as untrusted: every field is checked before it is used
- No `innerHTML` with dynamic content; the DOM is built with text nodes
- CI runs `npm audit`, CodeQL, and browser tests that fail on any CSP violation; Dependabot keeps dependencies and actions up to date

## Reporting a problem

Please open a [private security advisory](https://github.com/Shahryartariq/luckbox/security/advisories/new) rather than a public issue. I'll reply within a few days.
