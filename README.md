# DressPanic!

A Progressive Web App. Installable, offline-capable, no build step — plain HTML/CSS/JS deployed to GitHub Pages via GitHub Actions.

**Live:** https://aoprisan.github.io/dp/

## Project layout

```
.
├── index.html              # app shell
├── styles.css              # styles
├── app.js                  # bootstrap: SW registration, install prompt, network status
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

Edit `icons/icon.svg`, then re-render the PNGs:

```bash
magick -background none -density 384 icons/icon.svg -resize 192x192 icons/icon-192.png
magick -background none -density 384 icons/icon.svg -resize 512x512 icons/icon-512.png
```
