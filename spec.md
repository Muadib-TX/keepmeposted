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
    articleAnalyzer.js       Local analysis fallback
    analysisClient.js        Calls Gemini directly when configured
    badge.js                 Badge color/text logic
  /options
    options.html/js/css      Stores a user-provided Gemini key in extension-local storage
  /icons
    icon-16/48/128.png (green/yellow/red/neutral variants)

```

Data flow: `content script (extract) → background worker (cache and orchestration) → Gemini API or local analyzer → badge and popup`.

---

## 4. Component Specs

### 4.1 Article Detection (`articleDetector.js`)

Run cheaply and locally — **do not call Gemini for pages that clearly aren't articles.**

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
  - Otherwise, call Gemini directly from the service worker if the user has configured a key; if not, use the local analyzer.
2. Store the response in `chrome.storage.local` keyed by `canonicalUrl`.
3. Trigger badge update (4.3) and make the result available to the popup (4.4).
4. Handle Gemini errors or timeout by returning local analysis; never block article reading.
5. Analysis should include all of the following:
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
- **Freshness section**: show the latest update date, preferring JSON-LD `dateModified`, `article:modified_time`, `og:updated_time`, `last-modified`, or `time[itemprop="dateModified"]`, alongside the publication date for comparison. Also show the age in days and the 0–100 update-recency score. If no update date is available, label the publication date as the date used for the estimate; if neither date is available, say the update age could not be determined. Include a one-line explanation, and distinguish this recency estimate from verification that the article's facts are current.
- **Reliability section**: a 0–100 score plus 1–2 sentence rationale, and the domain it was scored against.
- **Topics section**: up to 3–5 most relevant themes extracted from the article.
- **Keep Me Posted section**: a merged section that includes the freshness summary, the Add alert CTA, and the follow-up theme buttons.
- A "Report incorrect" button (stub — just `console.log` the feedback for the prototype, no need to wire a real feedback pipeline).

Keep this to a single scrollable popup, ~360px wide, no additional navigation.

---

## 5. Analysis Modes

The extension may call Gemini directly from its service worker when the user has configured an API key. No application backend is required.

- With a key, send only article title, publication date, domain, and bounded article text to Google; do not send the canonical URL or embed the key in source.
- Without a key, or if Gemini fails, use local analysis. Local freshness is an update-age estimate (falling back to publication date), not verification that the underlying facts are current.
- Store the key in `chrome.storage.local`; this is suitable for personal use, not secure distribution of an extension containing a shared key.
- Keep the structured analysis contract consistent between Gemini and local fallback.

---

## 6. Non-Goals for This Prototype (explicitly out of scope)

- Real push notifications / topic subscriptions infrastructure — separate future milestone, not part of this build.
- A lightweight local alert bookmark is included in the popup so the user can track a story for later updates; actual delivery infrastructure remains future work.
- Firefox/Safari support — Chrome (Manifest V3) only.
- User accounts, auth, or sync across devices.
- Production-grade crawler or pre-computed cache warming — on-demand analysis only.
- Sophisticated readability/extraction library (e.g., full Mozilla Readability port) — the heuristics in 4.1 are sufficient.
- Styling polish beyond a clean, readable popup.
- A notification service for article/topic subscriptions — the prototype only stores local follow selections.

---

## 7. Acceptance Criteria

- [ ] Installing the unpacked extension and visiting a real news article (e.g., a Reuters or AP story) auto-populates the badge within ~3 seconds, no clicks required.
- [ ] Visiting a non-article page (e.g., google.com) results in no badge.
- [ ] Clicking the badge on an analyzed page shows the popup with freshness, reliability, topic, and follow-up sections populated.
- [ ] Revisiting the same URL within 24 hours does not trigger a new network call (verify via console/network tab).
- [ ] The extension works without any local or cloud application backend.
- [ ] With no Gemini key, local analysis still populates the badge and popup.
- [ ] With a Gemini key, the service worker calls Google's API and identifies Gemini as the analysis source.
- [ ] Removing the key clears cached analysis and returns the extension to local mode.
- [ ] Code is organized per the file structure in Section 3, with comments explaining the detection heuristics.
- [ ] The prototype demonstrates the main objective clearly: ambient article analysis plus suggested follow-up topic actions.

---

## 8. Suggested Build Order

1. Scaffold `manifest.json` + empty content script/background worker, confirm it loads in `chrome://extensions`.
2. Implement article detection + extraction (4.1), log results to console — verify on 3–5 real news sites before moving on.
3. Implement the local analyzer and verify freshness/date and theme behavior.
4. Wire badge updates (4.3) end-to-end using local results.
5. Build the popup (4.4), including the topic follow-up panel.
6. Add optional direct Gemini analysis and a local key settings page.
7. Add caching (4.2) and failure handling last.

---

## 9. Notes for Optimization

This version keeps analysis in the extension, with an optional direct Gemini call and a local fallback. Local freshness measures publication age; only Gemini attempts to assess the article's underlying event timeline.
