# Keep Me Posted

Current package version: 0.16

A Chrome Manifest V3 browser extension prototype that ambiently analyzes news articles and shows three signals in the toolbar badge and popup:

- Freshness: whether the article is presenting current facts or resurfacing old events.
- Reliability: a coarse trust signal for the source/domain.
- Topic follow-up: suggested topics and follow-up actions based on the article content.

## Version history


- 0.13 — Add automated version and README updates

- 0.14 — Update version metadata and README

- 0.15 — not sure
# Please enter the commit message for your changes. Lines starting
# with '#' will be ignored, and an empty message aborts the commit.
#
# On branch main
# Your branch is up to date with 'origin/main'.
#
# Changes to be committed:
#	modified:   README.md
#	modified:   package.json
#

- 0.16 — # Please enter the commit message for your changes. Lines starting
# with '#' will be ignored, and an empty message aborts the commit.
#
# On branch main
# Your branch is ahead of 'origin/main' by 1 commit.
#   (use "git push" to publish your local commits)
#
# Changes to be committed:
#	modified:   README.md
#	modified:   package.json
#
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
  - `lib/analysisClient.js`
  - `lib/badge.js`
  - `popup/`
- `backend/` — local analysis service
  - `server.js`
  - `mockData.json`
- `spec.md` — original project brief and requirements
- `package.json` — local scripts

## How it works

1. The content script runs on pages in Chrome and checks whether the page looks like a news article.
2. If it does, it extracts metadata such as title, publish date, domain, and main text.
3. The background service worker sends that payload to the local backend.
4. The backend returns a structured response containing freshness, reliability, topics, and follow-up suggestions.
5. The toolbar badge updates automatically, and the popup shows the detailed analysis.

## Requirements

- Chrome browser
- Node.js 18+
- GitHub CLI optional for pushing changes

## Install and run

### 1) Clone the project

```bash
git clone https://github.com/Muadib-TX/keepmeposted.git
cd keepmeposted
```

### 2) Install Node dependencies

This project uses only built-in Node.js modules, so there is no extra package installation step required.

### 3) Start the backend

```bash
cd /path/to/keepmeposted
node backend/server.js
```

You should see output like:

```text
Keep Me Posted backend is running on http://localhost:3001 with Gemini integration enabled
```

### 4) Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the project folder

### 5) Test the extension

- Open a real news article page
- Wait a few seconds for the badge to appear
- Click the extension icon to view the popup
- Open a non-article page like `google.com` to confirm no badge appears

## Gemini setup (optional)

The backend supports a Gemini-powered analysis path if you set the following environment variables before starting the server:

```bash
export GEMINI_API_KEY="your_gemini_api_key_here"
export GEMINI_MODEL="gemini-3.6-flash"
node backend/server.js
```

If no Gemini key is configured, the backend falls back to the mock responses in `backend/mockData.json`.

## Troubleshooting

### Port 3001 already in use

If the backend does not start, kill the process already using port 3001 and restart:

```bash
lsof -i :3001
kill -9 <PID>
node backend/server.js
```

### Extension badge does not appear

- Make sure the extension is loaded unpacked
- Make sure the backend is running
- Open a page that looks like a news article
- Check the browser console for content script messages

### Gemini request fails

The backend will log backend errors if the Gemini API is blocked or disabled. In that case, the prototype falls back to mock data automatically.

## Notes

This is a prototype designed for quick testing and iteration. It is intentionally lightweight and does not include production-grade reliability models, user accounts, or persistent storage.
