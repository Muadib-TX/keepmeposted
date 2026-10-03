# Keep Me Posted

Current package version: 0.32

A Chrome Manifest V3 browser extension prototype that ambiently analyzes news articles and shows three signals in the toolbar badge and popup:

- Freshness: whether the article is presenting current facts or resurfacing old events.
- Reliability: a coarse trust signal for the source/domain.
- Topic follow-up: suggested topics and follow-up actions based on the article content.

## Version history


- 0.13 — Add automated version and README updates

- 0.14 — Update version metadata and README

- 0.15 — not sure

- 0.16 — test

- 0.17 — test

- 0.18 — Update documentation and package version

- 0.19 — Update version and README

- 0.20 — Update spec and version metadata

- 0.21 — Rename alert section heading

- 0.22 — Refine alert tab CTA and follow-up styling

- 0.23 — Improve article analysis and popup branding

- 0.24 — Bump version to 0.23

- 0.25 — Bump version to 0.24

- 0.26 — Add update recency score to freshness check

- 0.27 — Bump version to 0.26

- 0.28 — test

- 0.29 — test3

- 0.30 — Clean version history and sync metadata

- 0.31 — Refine popup theme tags

- 0.32 — adding websearch + dashboard improvement
Recent git commit history reflected in this README:

- `7c88bd7` — Remove stale follow-up wording and polish labels
- `8d58eda` — Refine Keep me posted follow-up labels
- `64663de` — Add release notes history support
- `ba2fc2f` — Simplify theme follow-up CTA
- `2a6b84f` — Update follow-up button label
- `68a7f44` — Refine follow-up CTA layout
- `32b4e3d` — Refine follow-up actions UI
- `fea1aff` — Update branding to Keep Me Posted
- `dfbc71f` — Update reliability AI owner inference
- `e8f4777` — Add story alert option to freshness popup
- `0a5ff72` — read me addition
- `e7adaad` — ai usage extension
- `8bf2af5` — updating with llm live usage
- `cabe207` — first iteration
- `3a0217a` — initial commit

## Project structure

- `extension/` — Chrome extension files
  - `manifest.json`
  - `background/service-worker.js`
  - `content/detector.js`
  - `lib/articleDetector.js`
  - `lib/articleAnalyzer.js` — local fallback analysis
  - `lib/analysisClient.js` — direct Gemini API client with local fallback
  - `lib/badge.js`
  - `popup/`
- `extension/options/` — local Gemini API key and model settings
- `spec.md` — original project brief and requirements
- `package.json` — local scripts

## How it works

1. The content script runs on pages in Chrome and checks whether the page looks like a news article.
2. If it does, it extracts metadata such as title, publish date, last update date, domain, and main text.
3. The background service worker checks its 24-hour cache. With a Gemini key configured, it sends the title, publication date, domain, and up to 10,000 characters of article text directly to Google's Gemini API. Without a key, it analyzes the article locally.
4. The toolbar badge updates automatically, and the popup shows the analysis and local follow actions.

## Requirements

- Chrome browser
- Node.js 18+ only to run the repository checks

## Install and run

### 1) Clone the project

```bash
git clone https://github.com/Muadib-TX/keepmeposted.git
cd keepmeposted
```

### 2) Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the `extension/` folder

### 3) Test the extension

- Open a real news article page
- Wait a few seconds for the badge to appear
- Click the extension icon to view the popup
- Open a non-article page like `google.com` to confirm no badge appears

## Gemini setup (optional)

Open the extension's **Gemini settings**, paste your API key, and save. The key is stored in this browser profile and is sent directly from the extension service worker to Google; it is not embedded in the source or sent to an app backend. Do not distribute an unpacked extension containing your personal key. You can remove the key in the same settings page.

The model defaults to `gemini-2.0-flash` and can be changed in settings. The freshness panel includes a 0–100 update-recency score: it uses the page's last update date, falling back to its publication date, and decreases linearly to zero over 30 days. This score describes article recency, not whether its claims are true or its underlying facts remain current. Without Gemini, local analysis estimates recency only and cannot verify event facts.

Article title, publication date, last update date, domain, and up to 10,000 characters of article text are sent to Google when Gemini is enabled. The canonical URL is not sent.

## Troubleshooting

### Extension badge does not appear

- Make sure the extension is loaded unpacked
- Open a page that looks like a news article
- Check the browser console for content script messages

### Gemini request fails

Check the key and selected model in Gemini settings. The extension falls back to local analysis when the request fails.

## Development checks

```bash
npm run check
npm test
```

## Notes

This is a prototype designed for quick testing and iteration. Gemini requires an API key and sends article text to Google. The fallback and source-reliability ratings are simple local heuristics, not independent fact checking. Story and theme follows are stored only in this browser and do not send notifications.
