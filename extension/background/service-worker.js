importScripts('../lib/analysisClient.js', '../lib/badge.js');

const ANALYSIS_CACHE_PREFIX = 'analysis-cache:';
const TAB_STATE_PREFIX = 'tab-state-';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function keyForCanonicalUrl(canonicalUrl) {
  return `${ANALYSIS_CACHE_PREFIX}${canonicalUrl}`;
}

async function cacheAnalysis(canonicalUrl, analysis) {
  const key = await keyForCanonicalUrl(canonicalUrl);
  await chrome.storage.local.set({
    [key]: {
      cachedAt: Date.now(),
      analysis
    }
  });
}

async function getCachedAnalysis(canonicalUrl) {
  const key = await keyForCanonicalUrl(canonicalUrl);
  const result = await chrome.storage.local.get([key]);
  const entry = result[key];

  if (!entry) {
    return null;
  }

  const age = Date.now() - entry.cachedAt;

  if (age > CACHE_TTL_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }

  return entry.analysis;
}

async function handlePageDetection(message, sender) {
  const tabId = sender?.tab?.id;

  if (typeof tabId !== 'number') {
    return;
  }

  const article = message?.article || null;

  if (!article) {
    await chrome.storage.local.remove(`${TAB_STATE_PREFIX}${tabId}`);
    clearBadge(tabId);
    return;
  }

  const cachedAnalysis = await getCachedAnalysis(article.canonicalUrl);

  if (cachedAnalysis) {
    await chrome.storage.local.set({
      [`${TAB_STATE_PREFIX}${tabId}`]: {
        article,
        analysis: cachedAnalysis,
        cachedAt: Date.now()
      }
    });

    applyBadge(tabId, cachedAnalysis);
    return;
  }

  await chrome.storage.local.set({
    [`${TAB_STATE_PREFIX}${tabId}`]: {
      article,
      analysis: null,
      status: 'analyzing'
    }
  });

  setBadgeState(tabId, { text: '···', color: '#6b7280' });

  const analysis = await analyzeArticle(article);

  if (!analysis) {
    await chrome.storage.local.set({
      [`${TAB_STATE_PREFIX}${tabId}`]: {
        article,
        analysis: null,
        status: 'error'
      }
    });

    clearBadge(tabId);
    return;
  }

  await cacheAnalysis(article.canonicalUrl, analysis);

  await chrome.storage.local.set({
    [`${TAB_STATE_PREFIX}${tabId}`]: {
      article,
      analysis,
      cachedAt: Date.now()
    }
  });

  applyBadge(tabId, analysis);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await handlePageDetection(message, sender);
    sendResponse({ ok: true });
  })();

  return true;
});
