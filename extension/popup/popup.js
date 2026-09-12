document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');

  const titleEl = document.getElementById('title');
  const publishDateEl = document.getElementById('publishDate');
  const freshnessStatusEl = document.getElementById('freshnessStatus');
  const factDateEl = document.getElementById('factDate');
  const freshnessExplanationEl = document.getElementById('freshnessExplanation');
  const reliabilityScoreEl = document.getElementById('reliabilityScore');
  const reliabilityLabelEl = document.getElementById('reliabilityLabel');
  const domainEl = document.getElementById('domain');
  const reliabilityExplanationEl = document.getElementById('reliabilityExplanation');
  const topicsListEl = document.getElementById('topicsList');
  const followUpsListEl = document.getElementById('followUpsList');
  const reportButton = document.getElementById('reportButton');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const storageKey = `tab-state-${tab.id}`;
  const stored = await chrome.storage.local.get([storageKey]);
  const state = stored[storageKey];

  if (!state || !state.analysis) {
    loading.textContent = 'This page has not been analyzed yet.';
    return;
  }

  loading.classList.add('hidden');
  content.classList.remove('hidden');

  titleEl.textContent = state.article?.title || 'Untitled article';
  publishDateEl.textContent = state.article?.publishDate ? `Published: ${state.article.publishDate}` : 'Published date unavailable';

  const freshness = state.analysis.freshness || {};
  const reliability = state.analysis.reliability || {};
  const topics = Array.isArray(state.analysis.topics) ? state.analysis.topics : [];
  const followUps = Array.isArray(state.analysis.followUps) ? state.analysis.followUps : [];

  freshnessStatusEl.textContent = freshness.status ? `Status: ${freshness.status}` : 'Status: unknown';
  factDateEl.textContent = freshness.factDate ? `Fact date: ${freshness.factDate}` : 'Fact date: unavailable';
  freshnessExplanationEl.textContent = freshness.explanation || 'No explanation supplied.';

  reliabilityScoreEl.textContent = reliability.score !== undefined ? `Score: ${reliability.score}/100` : 'Score: unavailable';
  reliabilityLabelEl.textContent = reliability.label ? `Label: ${reliability.label}` : 'Label: unknown';
  domainEl.textContent = `Domain: ${state.article?.domain || 'Unknown domain'}`;
  reliabilityExplanationEl.textContent = reliability.explanation || 'No explanation supplied.';

  topicsListEl.innerHTML = topics.length
    ? topics
        .map((topic) => `<li>${topic.label}${topic.confidence ? ` (${Math.round(topic.confidence * 100)}%)` : ''}</li>`)
        .join('')
    : '<li>No topics detected.</li>';

  followUpsListEl.innerHTML = followUps.length
    ? followUps
        .map(
          (followUp) =>
            `<li><strong>${followUp.label}</strong><br /><span>${followUp.description}</span></li>`
        )
        .join('')
    : '<li>No follow-up suggestions available.</li>';

  reportButton.addEventListener('click', () => {
    console.log('Report incorrect clicked', {
      title: state.article?.title,
      canonicalUrl: state.article?.canonicalUrl,
      analysis: state.analysis
    });
  });
});
