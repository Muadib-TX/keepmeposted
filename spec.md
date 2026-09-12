# Build Prompt: "Freshness & Reliability" Browser Extension Prototype

> Paste everything below into a coding assistant (Claude Code, Cursor, etc.) as the task brief. It is written to be self-contained and unambiguous so the assistant does not need to ask clarifying questions to start building.

---

## 1. Objective

Build a Chrome browser extension (Manifest V3) prototype that ambiently analyzes news articles as the user browses and displays two signals in the toolbar badge:

1. **Freshness**: whether the article's core facts are current or the article is re-surfacing an old event without saying so.
2. **Reliability**: a coarse trust signal about the source/domain.
3.**Follow-up on topic** after analyzing the article, extract the most important themes or topics and propose the user to subscribe to a future update of the article or to subscribe to one of the chosen theme or story.

The extension must work with **zero user interaction required** for the base signal (badge updates automatically on page load) and reveal detail on click.

This is a **prototype**, not a production system. Prioritize a working end-to-end loop over completeness. Use mocked/stubbed data where a real data source would be out of scope (see Section 6, Non-Goals).

---

## 2. Core User Flow

1. User navigates to any web page in Chrome.
2. Extension's content script + background service worker silently determine whether the page is a "news article" (see Section 4.1).
3. If yes: extract the article's text + metadata → send to the analysis pipeline (Section 4.2) → receive `{freshness, reliability}` → update the toolbar badge (Section 4.3).
4. If the user clicks the toolbar icon: open a popup showing the detailed breakdown (Section 4.4).
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

Detect "this is an article" if **any** of the following match:
- `document.querySelector('script[type="application/ld+json"]')` contains `"@type": "NewsArticle"` or `"@type": "Article"`.
- `<meta property="og:type" content="article">` is present.
- A `<article>` tag exists with more than ~400 characters of text content.
- URL path matches common news patterns (e.g., contains `/news/`, `/article/`, `/story/`, or a date segment like `/2026/09/`).

Extract on match:
- `title` (from `<title>`, `og:title`, or `<h1>`)
- `publishDate` (from JSON-LD `datePublished`, `<meta property="article:published_time">`, or fallback: first ISO-8601-looking date string in the page)
- `mainText` (innerText of `<article>` or the largest text block on the page — use a simple readability heuristic: largest `<div>`/`<section>` by paragraph count)
- `domain` (`location.hostname`)
- `canonicalUrl` (`<link rel="canonical">` href, or current URL stripped of query params if absent)

Send `{title, publishDate, mainText, domain, canonicalUrl}` to the background worker via `chrome.runtime.sendMessage`.

### 4.2 Analysis Orchestration (`service-worker.js` + `analysisClient.js`)

1. On receiving article data from the content script:
   - Check local cache (`chrome.storage.local`, keyed by `canonicalUrl`) for a result younger than 24 hours. If found, skip the network call and go straight to badge update.
   - Otherwise, `POST` the article payload to the backend `/analyze` endpoint.
2. Store the response in `chrome.storage.local` keyed by `canonicalUrl`.
3. Trigger badge update (4.3) and make the result available to the popup (4.4).
4. Handle failure gracefully: on network error or timeout (>5s), set badge to a neutral "unknown" state — never block or show an error to the user.

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
- **Freshness section**: the "fact date" the model extracted (if different from publish date) and a one-line explanation (e.g., "This article was published today but references an event from March 2024").
- **Reliability section**: a 0–100 score plus 1–2 sentence rationale, and the domain it was scored against.
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
  }
}
```

For the prototype:
- `reliability` can be computed from a **hardcoded domain reputation table** (~20 entries covering major outlets across the trust spectrum, e.g. wire services = high, known-low-quality domains = low, everything else = medium/unknown). No need for a real scoring model.
- `freshness` can call an LLM (Claude via the Anthropic API) with a prompt like: *"Given this article title, publish date, and text, identify the primary factual event being reported and estimate when that event actually occurred. Compare to the publish date and flag if the article is presenting an old event as new. Respond in JSON: {factDate, status, explanation}."* This is the one place real intelligence is worth wiring up even in the prototype, since it's the core value proposition.
- No database needed — in-memory or flat-file caching is fine.

---

## 6. Non-Goals for This Prototype (explicitly out of scope)

- Topic monitoring / alerts / push notifications — separate future milestone, not part of this build.
- Firefox/Safari support — Chrome (Manifest V3) only.
- User accounts, auth, or sync across devices.
- Production-grade crawler or pre-computed cache warming — on-demand analysis only.
- Sophisticated readability/extraction library (e.g., full Mozilla Readability port) — the heuristics in 4.1 are sufficient.
- Styling polish beyond a clean, readable popup.

---

## 7. Acceptance Criteria

- [ ] Installing the unpacked extension and visiting a real news article (e.g., a Reuters or AP story) auto-populates the badge within ~3 seconds, no clicks required.
- [ ] Visiting a non-article page (e.g., google.com) results in no badge.
- [ ] Clicking the badge on an analyzed page shows the popup with both freshness and reliability sections populated.
- [ ] Revisiting the same URL within 24 hours does not trigger a new network call (verify via console/network tab).
- [ ] Killing the backend server and reloading a page results in a neutral badge state, not a broken extension.
- [ ] Code is organized per the file structure in Section 3, with comments explaining the detection heuristics.

---

## 8. Suggested Build Order

1. Scaffold `manifest.json` + empty content script/background worker, confirm it loads in `chrome://extensions`.
2. Implement article detection + extraction (4.1), log results to console — verify on 3–5 real news sites before moving on.
3. Stand up the backend stub with hardcoded/mocked responses (5), no LLM call yet — verify the full request/response loop.
4. Wire badge updates (4.3) end-to-end using the mocked backend.
5. Build the popup (4.4).
6. Swap the mocked freshness response for a real Claude API call.
7. Add caching (4.2) and failure handling last.
