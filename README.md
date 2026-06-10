# Dress Panic

The archive for the things you wear. A local-first social wardrobe PWA — installable, offline-capable, no build step — plain HTML/CSS/JS deployed to GitHub Pages via GitHub Actions.

**Live:** https://aoprisan.github.io/dp/

## Features

- **The Archive** — wardrobe item catalogue: multi-photo pieces (stored as Blobs in IndexedDB, downscaled client-side), tags, visibility scopes (public / circle / private), filtering, full add/revise/remove flows, persistent accession numbers (Nº 001…).
- Looks, Feed, and You are stubbed in the tab bar — coming feature by feature.

All data lives in IndexedDB on-device. No backend, no accounts.

## Project layout

```
.
├── index.html              # app shell (masthead, archive, editor + detail sheets, tab bar)
├── styles.css              # design system: paper/ink/panic-red editorial theme
├── app.js                  # bootstrap: SW registration, install prompt, edition badge, tabs
├── js/
│   ├── db.js               # IndexedDB layer (items, tags, meta counter)
│   ├── wardrobe.js         # The Archive: rendering, filters, editor, detail
│   └── ui.js               # shared helpers (toast)
├── fonts/                  # self-hosted Fraunces, Instrument Sans, JetBrains Mono (woff2)
├── sw.js                   # service worker (cache-first app shell)
├── manifest.webmanifest    # PWA manifest
├── icons/                  # icon.svg + generated PNGs (192, 512)
├── .nojekyll               # tell Pages to serve files as-is
└── .github/workflows/deploy.yml   # CI deploy to GitHub Pages
```

All asset paths are **relative** so the app works correctly under the `/dp/` project subpath on GitHub Pages.

## Local development

No tooling required — just serve the folder over HTTP (service workers need a server, not `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which publishes the repo root to GitHub Pages.

**One-time setup:** in the repo settings → **Pages** → **Build and deployment** → set **Source** to **GitHub Actions**.

## Updating the service worker cache

When you change shell assets (`index.html`, `styles.css`, `app.js`, etc.), bump `CACHE_VERSION` in `sw.js` so clients fetch the new files instead of stale cached ones.

## Regenerating icons

Edit `icons/icon.svg`, then re-render the PNGs (headless Chrome matches browser SVG rendering exactly):

```bash
cd icons
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --screenshot=icon-512.png --window-size=512,512 --hide-scrollbars "file://$PWD/icon.svg"
magick icon-512.png -resize 192x192 icon-192.png
```
