document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const titleEl = document.getElementById('title');
  const publishDateEl = document.getElementById('publishDate');
  const alertStatusEl = document.getElementById('alertStatus');
  const reliabilityScoreEl = document.getElementById('reliabilityScore');
  const reliabilityLabelEl = document.getElementById('reliabilityLabel');
  const domainEl = document.getElementById('domain');
  const ownerNameEl = document.getElementById('ownerName');
  const ownerTypeEl = document.getElementById('ownerType');
  const ownerDescriptionEl = document.getElementById('ownerDescription');
  const reliabilityExplanationEl = document.getElementById('reliabilityExplanation');
  const topicsListEl = document.getElementById('topicsList');
  const followStoryButton = document.getElementById('followStoryButton');
  const reportButton = document.getElementById('reportButton');
  const settingsButton = document.getElementById('settingsButton');
  settingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());

  const updateStatusBadge = (element, value, labels = {}) => {
    const normalized = String(value || 'unknown').toLowerCase();
    element.classList.add('status-badge');
    element.textContent = labels[normalized] || `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
    element.dataset.state = normalized;
  };

  const formatDate = (value, fallback) => {
    if (!value) return fallback;
    const rawValue = String(value).trim();
    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
      : new Date(rawValue);

    if (Number.isNaN(date.getTime())) return `${fallback}: ${rawValue}`;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  };

  const parseDate = (value) => {
    if (!value) return null;
    const rawValue = String(value).trim();
    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
      : new Date(rawValue);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const calendarDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const formatElapsedDays = (days) => days < 0
    ? `${Math.abs(days)} days in the future`
    : days === 0
      ? 'today'
      : days === 1
        ? '1 day ago'
        : `${days} days ago`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    loading.textContent = 'No active tab is available.';
    return;
  }

  const storageKey = `tab-state-${tab.id}`;
  const stored = await chrome.storage.local.get([storageKey]);
  const state = stored[storageKey];

  if (!state || !state.analysis) {
    loading.textContent = state?.status === 'error'
      ? 'Analysis is unavailable. Reload the article to try again.'
      : 'This page has not been analyzed yet.';
    return;
  }

  loading.classList.add('hidden');
  content.classList.remove('hidden');

  titleEl.textContent = state.article?.title || 'Untitled article';
  publishDateEl.textContent = `Published ${formatDate(state.article?.publishDate, 'date unavailable')}`;

  const reliability = state.analysis.reliability || {};

  const topics = Array.isArray(state.analysis.topics) ? state.analysis.topics : [];
  const storyIdentifier = state.article?.canonicalUrl || state.article?.url || state.article?.title || null;

  reliabilityScoreEl.textContent = reliability.score !== undefined ? `Score: ${reliability.score}/100` : 'Score: unavailable';
  updateStatusBadge(reliabilityLabelEl, reliability.label);
  domainEl.textContent = `Domain: ${state.article?.domain || 'Unknown domain'}`;
  const owner = reliability.owner || {};
  ownerNameEl.textContent = owner.name || state.article?.domain || 'Media unavailable';
  ownerTypeEl.textContent = owner.type ? `Owner type: ${owner.type}` : 'Owner type: unavailable';
  ownerDescriptionEl.textContent = owner.description || 'No owner description available.';
  reliabilityExplanationEl.textContent = reliability.explanation || 'No explanation supplied.';

  const refreshStoryState = async () => {
    const result = await chrome.storage.local.get(['story-alerts']);
    const alerts = Array.isArray(result['story-alerts']) ? result['story-alerts'] : [];
    const isFollowing = alerts.some((alert) => alert.canonicalUrl === storyIdentifier);
    followStoryButton.textContent = isFollowing ? 'Following this story' : 'Follow this story';
    followStoryButton.setAttribute('aria-pressed', String(isFollowing));
    alertStatusEl.textContent = isFollowing
      ? 'Saved in this browser. Push notifications are not enabled.'
      : 'Saved follows stay in this browser; push notifications are not enabled.';
  };

  followStoryButton.disabled = !storyIdentifier;
  followStoryButton.addEventListener('click', async () => {
    if (!storyIdentifier) return;
    const result = await chrome.storage.local.get(['story-alerts']);
    const alerts = Array.isArray(result['story-alerts']) ? result['story-alerts'] : [];
    const isFollowing = alerts.some((alert) => alert.canonicalUrl === storyIdentifier);
    const nextAlerts = alerts.filter((alert) => alert.canonicalUrl !== storyIdentifier);

    if (!isFollowing) {
      nextAlerts.unshift({
        canonicalUrl: storyIdentifier,
        title: state.article?.title || 'Untitled article',
        domain: state.article?.domain || 'Unknown domain',
        addedAt: Date.now()
      });
    }

    await chrome.storage.local.set({ 'story-alerts': nextAlerts });
    await refreshStoryState();
  });

  const refreshThemeState = async () => {
    const result = await chrome.storage.local.get(['followed-themes']);
    const followedThemes = Array.isArray(result['followed-themes']) ? result['followed-themes'] : [];
    topicsListEl.replaceChildren();

    if (!topics.length) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'topics-empty';
      emptyItem.textContent = 'No themes were identified.';
      topicsListEl.append(emptyItem);
      return;
    }

    topics.slice(0, 8).forEach((topic) => {
      const label = String(topic.label || '').trim();
      if (!label) return;

      const isFollowing = followedThemes.some((theme) => theme.toLowerCase() === label.toLowerCase());
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'follow-theme-button';
      button.textContent = label;
      button.setAttribute('aria-pressed', String(isFollowing));
      button.addEventListener('click', async () => {
        const latest = await chrome.storage.local.get(['followed-themes']);
        const currentThemes = Array.isArray(latest['followed-themes']) ? latest['followed-themes'] : [];
        const alreadyFollowing = currentThemes.some((theme) => theme.toLowerCase() === label.toLowerCase());
        const nextThemes = currentThemes.filter((theme) => theme.toLowerCase() !== label.toLowerCase());
        if (!alreadyFollowing) nextThemes.unshift(label);
        await chrome.storage.local.set({ 'followed-themes': nextThemes });
        await refreshThemeState();
      });
      topicsListEl.append(button);
    });
  };

  await Promise.all([refreshStoryState(), refreshThemeState()]);

  reportButton.addEventListener('click', () => {
    console.log('Report incorrect clicked', {
      title: state.article?.title,
      canonicalUrl: state.article?.canonicalUrl,
      analysis: state.analysis
    });
  });
});
