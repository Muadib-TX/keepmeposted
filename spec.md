# Build Prompt: "Keep Me Posted" Browser Extension Prototype

> Paste everything below into a coding assistant (Claude Code, Cursor, etc.) as the task brief. It is written to be self-contained and unambiguous so the assistant does not need to ask clarifying questions to start building.

---

## 1. Objective

Build a Chrome browser extension (Manifest V3) prototype that ambiently analyzes news articles as the user browses and surfaces three signals in the toolbar badge and popup:

1. **Freshness**: whether the article's core facts are current or the article is re-surfacing an old event without saying so.
2. **Reliability**: a coarse trust signal about the source/domain.
3. **Topic follow-up**: after analyzing the article, extract the most important themes or topics and suggest a follow-up action such as subscribing to updates for the article or for a highlighted theme/story.

The extension must work with **zero user interaction required** for the base signal (badge updates automatically on page load) and reveal detail on click.

This is a **prototype**, not a production system. Prioritize a working end-to-end loop over completeness. Use mocked/stubbed data where a real data source would be out of scope (see Section 6, Non-Goals).

Current implementation status:
- The popup combines freshness and follow-up actions into a single **Keep Me Posted** section.
- The CTA is button-first, with a compact, readable layout designed for quick scanning.
- The project version is currently `0.19`.

---

## 2. Core User Flow

1. User navigates to any web page in Chrome.
2. The extension's content script + background service worker silently determine whether the page is a news article (see Section 4.1).
3. If yes: extract article text + metadata → send the payload to the analysis pipeline (Section 4.2) → receive `{freshness, reliability, topics, followUps}` → update the toolbar badge (Section 4.3).
4. If the user clicks the toolbar icon: open a popup showing the detailed breakdown plus topic follow-up suggestions (Section 4.4).
5. No modal, no page injection, no interruption to reading — badge-only ambient signal, popup-only detail.

---

## 3. Architecture

```
/extension
  /manifest.json          Manifest V3 config
  /background
    service-worker.js     Orchestrates detection → analysis → badge update
  /content
    detector.js            Runs in-page: article detection + extraction
  /popup
    popup.html / popup.js / popup.css   Detail view on icon click
  /lib
    articleDetector.js      Heuristics (Section 4.1)
    analysisClient.js        Calls backend API, handles caching
    badge.js                 Badge color/text logic
  /icons
    icon-16/48/128.png (green/yellow/red/neutral variants)

/backend  (separate lightweight service — see Section 5)
  server.js / app.py        API stub: POST /analyze
  mockData.json              Canned responses keyed by URL pattern, for prototype use
```

Data flow: `content script (extract) → background worker (orchestrate + cache) → backend API (analyze) → background worker (update badge + store for popup)`.

---

## 4. Component Specs

### 4.1 Article Detection (`articleDetector.js`)

Run cheaply and locally — **do not call the backend for pages that clearly aren't articles.**

Detect "this is an article" if any of the following match:
- `document.querySelector('script[type="application/ld+json"]')` contains `"@type": "NewsArticle"` or `"@type": "Article"`.
- `<meta property="og:type" content="article">` is present.
- A `<article>` tag exists with more than ~400 characters of text content.
- URL path matches common news patterns (e.g., contains `/news/`, `/article/`, `/story/`, or a date segment like `/2026/09/`).

Extract on match:
- `title` (from `<title>`, `og:title`, or `<h1>`)
- `publishDate` (from JSON-LD `datePublished`, `<meta property="article:published_time">`, or fallback: first ISO-8601-looking date string in the page)
- `mainText` (innerText of `<article>` or the largest text block on the page — use a simple readability heuristic: largest `<div>`/`<section>` by paragraph count)
- `domain` (`location.hostname`)
- `canonicalUrl` (`<link rel="canonical">`, or current URL stripped of query params if absent)

Send `{title, publishDate, mainText, domain, canonicalUrl}` to the background worker via `chrome.runtime.sendMessage`.

### 4.2 Analysis Orchestration (`service-worker.js` + `analysisClient.js`)

1. On receiving article data from the content script:
   - Check local cache (`chrome.storage.local`, keyed by `canonicalUrl`) for a result younger than 24 hours. If found, skip the network call and go straight to badge update.
   - Otherwise, `POST` the article payload to the backend `/analyze` endpoint.
2. Store the response in `chrome.storage.local` keyed by `canonicalUrl`.
3. Trigger badge update (4.3) and make the result available to the popup (4.4).
4. Handle failure gracefully: on network error or timeout (>5s), set badge to a neutral "unknown" state — never block or show an error to the user.
5. When the backend responds, the payload should include all of the following:
   - `freshness` (status, factDate, explanation)
   - `reliability` (score, label, explanation)
   - `topics` (top themes extracted from the article; use 2–5 concise labels)
   - `followUps` (suggested next actions rendered as compact theme buttons in the merged Keep Me Posted section)

### 4.3 Badge Logic (`badge.js`)

Toolbar badge is the **only** ambient UI element. No banners, no content injection into the page.

| State | Badge color | Badge text | Meaning |
|---|---|---|---|
| Fresh + reliable | Green | `✓` | Facts current, source trusted |
| Fresh + questionable source | Yellow | `!` | Facts current, source reliability uncertain |
| Stale facts detected | Orange | `⏱` | Article may be re-surfacing an old event |
| Low reliability | Red | `✕` | Source has known reliability issues |
| Not analyzed / not an article | (none) | (none) | Default icon, no badge |
| Analyzing | Grey | `···` | Transient, shown only while the network call is in flight |

Use `chrome.action.setBadgeText` and `chrome.action.setBadgeBackgroundColor`, scoped per-tab (`tabId` parameter) so badge state is correct when switching tabs.

### 4.4 Popup Detail View (`popup.html/js`)

On click, show:
- Article title + detected publish date.
- **Freshness section**: the "fact date" the model extracted (if different from publish date) and a one-line explanation.
- **Reliability section**: a 0–100 score plus 1–2 sentence rationale, and the domain it was scored against.
- **Topics section**: up to 3–5 most relevant themes extracted from the article.
- **Keep Me Posted section**: a merged section that includes the freshness summary, the Add alert CTA, and the follow-up theme buttons.
- A "Report incorrect" button (stub — just `console.log` the feedback for the prototype, no need to wire a real feedback pipeline).

Keep this to a single scrollable popup, ~360px wide, no additional navigation.

---

## 5. Backend Stub

Build a minimal local server (Node/Express or Python/FastAPI — assistant's choice, prefer whichever is faster to stand up) exposing:

```
POST /analyze
Body: { title, publishDate, mainText, domain, canonicalUrl }
Response: {
  freshness: {
    status: "fresh" | "stale" | "unknown",
    factDate: "2026-03-01" | null,
    explanation: string
  },
  reliability: {
    score: 0-100,
    label: "high" | "medium" | "low",
    explanation: string
  },
  topics: [
    { label: string, confidence: 0-1 }
  ],
  followUps: [
    { type: "article" | "theme", label: string }
  ]
}
```

For the prototype:
- `reliability` can be computed from a **hardcoded domain reputation table** (~20 entries covering major outlets across the trust spectrum, e.g. wire services = high, known-low-quality domains = low, everything else = medium/unknown). No need for a real scoring model.
- `freshness` can call a Gemini API (preferred for this prototype), or a mock/fallback response if no API key is configured. The Gemini path should take the article payload and return JSON shaped like `{status, factDate, explanation}`.
- `topics` and `followUps` can be produced from a lightweight heuristic or a model prompt. The important part is that the response is structured and usable by the popup.
- In the UI, follow-up actions should render as compact buttons labeled with the relevant theme, with the Add alert CTA preserved in the merged Keep Me Posted section.
- No database needed — in-memory or flat-file caching is fine.
- Multiple response modes are acceptable as long as they preserve the same JSON contract: mock mode, Gemini mode, and graceful fallback mode.

---

## 6. Non-Goals for This Prototype (explicitly out of scope)

- Real push notifications / topic subscriptions infrastructure — separate future milestone, not part of this build.
- A lightweight local alert bookmark is included in the popup so the user can track a story for later updates; actual delivery infrastructure remains future work.
- Firefox/Safari support — Chrome (Manifest V3) only.
- User accounts, auth, or sync across devices.
- Production-grade crawler or pre-computed cache warming — on-demand analysis only.
- Sophisticated readability/extraction library (e.g., full Mozilla Readability port) — the heuristics in 4.1 are sufficient.
- Styling polish beyond a clean, readable popup.
- A real backend system for article/topic subscriptions — the prototype only needs to surface suggested follow-up actions.

---

## 7. Acceptance Criteria

- [ ] Installing the unpacked extension and visiting a real news article (e.g., a Reuters or AP story) auto-populates the badge within ~3 seconds, no clicks required.
- [ ] Visiting a non-article page (e.g., google.com) results in no badge.
- [ ] Clicking the badge on an analyzed page shows the popup with freshness, reliability, topic, and follow-up sections populated.
- [ ] Revisiting the same URL within 24 hours does not trigger a new network call (verify via console/network tab).
- [ ] Killing the backend server and reloading a page results in a neutral badge state, not a broken extension.
- [ ] Code is organized per the file structure in Section 3, with comments explaining the detection heuristics.
- [ ] The prototype demonstrates the main objective clearly: ambient article analysis plus suggested follow-up topic actions.

---

## 8. Suggested Build Order

1. Scaffold `manifest.json` + empty content script/background worker, confirm it loads in `chrome://extensions`.
2. Implement article detection + extraction (4.1), log results to console — verify on 3–5 real news sites before moving on.
3. Stand up the backend stub with hardcoded/mocked responses (5), and include the `topics` + `followUps` fields even in mock mode.
4. Wire badge updates (4.3) end-to-end using the mocked backend.
5. Build the popup (4.4), including the topic follow-up panel.
6. Add Gemini-backed freshness analysis and keep the mock response as a fallback.
7. Add caching (4.2) and failure handling last.

---

## 9. Notes for Optimization

This version is optimized for the stated objective by making the follow-up topic workflow explicit and by aligning the backend response schema with the full value proposition. In other words, the prototype is not only measuring freshness and reliability — it is also surfacing the most relevant story themes and suggesting next actions in a lightweight, testable way.
