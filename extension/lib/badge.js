function applyBadge(tabId, analysis) {
  const freshnessStatus = analysis?.freshness?.status || 'unknown';
  const reliabilityLabel = analysis?.reliability?.label || 'unknown';

  let text = '✓';
  let color = '#16a34a';

  if (freshnessStatus === 'stale') {
    text = '⏱';
    color = '#f59e0b';
  } else if (freshnessStatus === 'unknown') {
    text = '!';
    color = '#fbbf24';
  }

  if (reliabilityLabel === 'low') {
    text = '✕';
    color = '#dc2626';
  }

  if (freshnessStatus === 'fresh' && reliabilityLabel === 'high') {
    text = '✓';
    color = '#16a34a';
  }

  if (freshnessStatus === 'fresh' && reliabilityLabel === 'medium') {
    text = '!';
    color = '#fbbf24';
  }

  setBadgeState(tabId, { text, color });
}

function setBadgeState(tabId, { text, color }) {
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: '' });
}
