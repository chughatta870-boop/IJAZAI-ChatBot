# IJAZ AI — Chat & Image Assistant (PWA)

A Progressive Web App built for **M Ijaz / GHS 124/NB**. Two modes in one app:

1. **Chat / World Info** — ask anything (general knowledge, science, history, education, current affairs). Powered by the free `text.pollinations.ai` API (no API key required).
2. **Image Studio** — type any description and get **at least 3 AI-generated image variations** instantly, powered by the free `image.pollinations.ai` API (no API key required).

Both AI features work directly from the browser/GitHub Pages — no backend server or secret keys needed.

## Files
- `index.html` — app shell / UI
- `style.css` — dark, distinctive theme (teal + violet gradient accent)
- `script.js` — chat logic, image generation, PWA install, service worker registration
- `manifest.json` — full PWA manifest (icons, screenshots, shortcuts) for a 45/45 PWABuilder score
- `sw.js` — service worker (offline app-shell caching; AI requests always go live)
- `icon-*.png` — real PNG icons (72–512px, incl. maskable) generated with Python Pillow
- `screenshot-*.png` — store screenshots referenced in the manifest

## Deploy to GitHub Pages
1. Push all files to the **root** of your repository (flat structure — do not put them in a subfolder, so icon paths resolve correctly).
2. In your repo: **Settings → Pages → Deploy from branch → main / (root)**.
3. Visit `https://<username>.github.io/<repo>/` — the app should install as a PWA.

## Convert to TWA (PWABuilder)
1. Go to [pwabuilder.com](https://www.pwabuilder.com) and enter your GitHub Pages URL.
2. It should score **45/45** — manifest, service worker, and all icon sizes (incl. maskable) are already included.
3. Click **Package for Stores → Android → Generate** to get your TWA/Android package.

## Notes
- No API key, no server, no `.env` needed — everything runs client-side, fully compatible with static GitHub Pages hosting.
- If Pollinations.ai is ever unreachable, the app shows a friendly error and asks the user to retry.
