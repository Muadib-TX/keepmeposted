document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');

  const titleEl = document.getElementById('title');
  const publishDateEl = document.getElementById('publishDate');
  const summaryEl = document.getElementById('summary');
  const freshnessStatusEl = document.getElementById('freshnessStatus');
  const factDateEl = document.getElementById('factDate');
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

  const formatPublishDate = (value) => {
    if (!value) return 'Publication date unavailable';

    const rawValue = String(value).trim();
    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
      : new Date(rawValue);

    if (Number.isNaN(date.getTime())) return `Published ${rawValue}`;

    const options = dateOnlyMatch
      ? { dateStyle: 'medium' }
      : { dateStyle: 'medium', timeStyle: 'short' };

    return `Published ${new Intl.DateTimeFormat(undefined, options).format(date)}`;
  };

  const formatFactDate = (value) => {
    if (!value) return 'Fact date unavailable';

    const dateOnlyMatch = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
      : new Date(value);

    if (Number.isNaN(date.getTime())) return `Fact date: ${value}`;

    return `Fact date: ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}`;
  };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const storageKey = `tab-state-${tab.id}`;
  const stored = await chrome.storage.local.get([storageKey]);
  const state = stored[storageKey];

  if (!state || !state.analysis) {
    loading.textContent = state?.status === 'error'
      ? 'Analysis is unavailable. Start the local backend and reload the article.'
      : 'This page has not been analyzed yet.';
    return;
  }

  loading.classList.add('hidden');
  content.classList.remove('hidden');

  titleEl.textContent = state.article?.title || 'Untitled article';
  publishDateEl.textContent = formatPublishDate(state.article?.publishDate);

  const freshness = state.analysis.freshness || {};
  summaryEl.textContent = state.analysis.summary || 'Summary unavailable.';
  const reliability = state.analysis.reliability || {};
  const topics = Array.isArray(state.analysis.topics) ? state.analysis.topics : [];
  const followUps = Array.isArray(state.analysis.followUps) && state.analysis.followUps.length
    ? state.analysis.followUps
    : topics.map((topic) => ({
        type: 'theme',
        label: topic.label
      }));

  const storyIdentifier = state.article?.canonicalUrl || state.article?.url || state.article?.title || null;

  let savedAlerts = [];
  let existingAlert = null;

  const updateAlertStatus = () => {
    const isSaved = Boolean(existingAlert);
    alertStatusEl.textContent = isSaved ? 'Following this story.' : '';
  };

  const refreshAlertState = async () => {
    const alertStorage = await chrome.storage.local.get(['story-alerts']);
    savedAlerts = Array.isArray(alertStorage['story-alerts']) ? alertStorage['story-alerts'] : [];
    existingAlert = storyIdentifier
      ? savedAlerts.find((alert) => alert.canonicalUrl === storyIdentifier)
      : null;

    updateAlertStatus();
  };

  const toggleCurrentAlert = async () => {
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

    await refreshAlertState();
  };

  await refreshAlertState();

  updateStatusBadge(freshnessStatusEl, freshness.status, 'unknown');
  factDateEl.textContent = formatFactDate(freshness.factDate);

  reliabilityScoreEl.textContent = reliability.score !== undefined ? `Score: ${reliability.score}/100` : 'Score: unavailable';
  updateStatusBadge(reliabilityLabelEl, reliability.label, 'unknown');
  domainEl.textContent = `Domain: ${state.article?.domain || 'Unknown domain'}`;
  const owner = reliability.owner || {};
  ownerNameEl.textContent = owner.name || state.article?.domain || 'Media unavailable';
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
        .map((followUp) => {
          const buttonClasses = [
            'secondary-button',
            'follow-up-button',
            followUp.type === 'article' ? 'article-follow-up-button' : ''
          ]
            .filter(Boolean)
            .join(' ');

          return `<li class="follow-up-item ${followUp.type === 'article' ? 'article-follow-up-item' : ''}"><button type="button" class="${buttonClasses}" data-followup-type="${followUp.type}">${followUp.label}</button></li>`;
        })
        .join('')
    : '<li>No follow-up suggestions available.</li>';

  followUpsListEl.querySelectorAll('.follow-up-button').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.dataset.followupType === 'article') {
        await toggleCurrentAlert();
      }
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
