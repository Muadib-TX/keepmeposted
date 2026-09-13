document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');

  const titleEl = document.getElementById('title');
  const publishDateEl = document.getElementById('publishDate');
  const freshnessStatusEl = document.getElementById('freshnessStatus');
  const factDateEl = document.getElementById('factDate');
  const freshnessExplanationEl = document.getElementById('freshnessExplanation');
  const toggleAlertButton = document.getElementById('toggleAlertButton');
  const alertStatusEl = document.getElementById('alertStatus');
  const reliabilityScoreEl = document.getElementById('reliabilityScore');
  const reliabilityLabelEl = document.getElementById('reliabilityLabel');

  const updateStatusBadge = (element, value, defaultValue = 'unknown') => {
    const normalized = (value || defaultValue).toLowerCase();
    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    element.classList.add('status-badge');
    element.textContent = label;
    element.dataset.state = normalized;
  };
  const domainEl = document.getElementById('domain');
  const ownerNameEl = document.getElementById('ownerName');
  const ownerTypeEl = document.getElementById('ownerType');
  const ownerDescriptionEl = document.getElementById('ownerDescription');
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

  const alertStorage = await chrome.storage.local.get(['story-alerts']);
  const savedAlerts = Array.isArray(alertStorage['story-alerts']) ? alertStorage['story-alerts'] : [];
  const storyIdentifier = state.article?.canonicalUrl || state.article?.url || state.article?.title || null;

  let existingAlert = storyIdentifier
    ? savedAlerts.find((alert) => alert.canonicalUrl === storyIdentifier)
    : null;

  const updateAlertButton = () => {
    const isSaved = Boolean(existingAlert);
    toggleAlertButton.disabled = !storyIdentifier;
    toggleAlertButton.textContent = isSaved ? 'Remove alert' : 'Add alert';
    alertStatusEl.textContent = isSaved
      ? 'Alert saved — you will be notified when this story updates.'
      : 'Save this story as an alert to track updates and new developments.';
  };

  updateAlertButton();

  toggleAlertButton.addEventListener('click', async () => {
    if (!storyIdentifier) {
      return;
    }

    const nextAlerts = savedAlerts.filter((alert) => alert.canonicalUrl !== storyIdentifier);

    if (existingAlert) {
      await chrome.storage.local.set({ 'story-alerts': nextAlerts });
    } else {
      nextAlerts.unshift({
        canonicalUrl: storyIdentifier,
        title: state.article?.title || 'Untitled article',
        domain: state.article?.domain || 'Unknown domain',
        addedAt: Date.now(),
        freshnessStatus: freshness.status || 'unknown'
      });
      await chrome.storage.local.set({ 'story-alerts': nextAlerts });
    }

    const refreshedStorage = await chrome.storage.local.get(['story-alerts']);
    const refreshedAlerts = Array.isArray(refreshedStorage['story-alerts']) ? refreshedStorage['story-alerts'] : [];
    const refreshedAlert = refreshedAlerts.find((alert) => alert.canonicalUrl === storyIdentifier);

    if (refreshedAlert) {
      existingAlert = refreshedAlert;
    } else {
      existingAlert = null;
    }

    updateAlertButton();
  });

  updateStatusBadge(freshnessStatusEl, freshness.status, 'unknown');
  factDateEl.textContent = freshness.factDate ? `Fact date: ${freshness.factDate}` : 'Fact date: unavailable';
  freshnessExplanationEl.textContent = freshness.explanation || 'No explanation supplied.';

  reliabilityScoreEl.textContent = reliability.score !== undefined ? `Score: ${reliability.score}/100` : 'Score: unavailable';
  updateStatusBadge(reliabilityLabelEl, reliability.label, 'unknown');
  domainEl.textContent = `Domain: ${state.article?.domain || 'Unknown domain'}`;
  const owner = reliability.owner || {};
  ownerNameEl.textContent = owner.name ? `Owner: ${owner.name}` : 'Owner: unavailable';
  ownerTypeEl.textContent = owner.type ? `Owner type: ${owner.type}` : 'Owner type: unavailable';
  ownerDescriptionEl.textContent = owner.description || 'No owner description available.';
  reliabilityExplanationEl.textContent = reliability.explanation || 'No explanation supplied.';

  topicsListEl.innerHTML = topics.length
    ? topics
        .map((topic) => {
          const query = encodeURIComponent(topic.label);
          const label = `${topic.label}${topic.confidence ? ` (${Math.round(topic.confidence * 100)}%)` : ''}`;
          return `<li><a href="https://news.google.com/search?q=${query}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
        })
        .join('')
    : '<li>No topics detected.</li>';

  followUpsListEl.innerHTML = followUps.length
    ? followUps
        .map(
          (followUp) =>
            `<li class="follow-up-item"><div class="follow-up-header"><span class="follow-up-label">${followUp.label}</span></div><button type="button" class="secondary-button follow-up-button" data-followup-type="${followUp.type}">Sign up</button></li>`
        )
        .join('')
    : '<li>No follow-up suggestions available.</li>';

  followUpsListEl.querySelectorAll('.follow-up-button').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!storyIdentifier) {
        return;
      }

      await toggleAlertButton.click();
    });
  });

  reportButton.addEventListener('click', () => {
    console.log('Report incorrect clicked', {
      title: state.article?.title,
      canonicalUrl: state.article?.canonicalUrl,
      analysis: state.analysis
    });
  });
});
