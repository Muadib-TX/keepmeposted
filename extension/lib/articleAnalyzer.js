(function (root) {
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  const freshnessWindowDays = 30;
  const stopWords = new Set([
    'about', 'after', 'again', 'against', 'also', 'among', 'because', 'been', 'before', 'being', 'between',
    'could', 'from', 'have', 'into', 'just', 'more', 'most', 'other', 'over', 'same', 'should', 'some',
    'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
    'under', 'very', 'were', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your', 'article',
    'story', 'news', 'said', 'will', 'says', 'according', 'report', 'reports', 'reported', 'officials',
    'people', 'year', 'years', 'today', 'latest', 'amid', 'around', 'first', 'last', 'make', 'made', 'many',
    'much', 'well', 'like', 'including', 'still', 'since', 'while', 'during', 'however', 'show', 'shows'
  ]);

  const reputation = {
    'reuters.com': {
      score: 90,
      label: 'high',
      name: 'Reuters',
      type: 'Wire service',
      explanation: 'Reuters is listed as a high-reliability wire service in this prototype.'
    },
    'apnews.com': {
      score: 88,
      label: 'high',
      name: 'The Associated Press',
      type: 'News cooperative',
      explanation: 'The Associated Press is listed as a high-reliability news cooperative in this prototype.'
    },
    'nytimes.com': {
      score: 76,
      label: 'medium',
      name: 'The New York Times Company',
      type: 'Media company',
      explanation: 'The New York Times is assigned a medium score in this prototype.'
    },
    'cnn.com': {
      score: 68,
      label: 'medium',
      name: 'Warner Bros. Discovery',
      type: 'Media conglomerate',
      explanation: 'CNN is assigned a medium score in this prototype.'
    },
    'foxnews.com': {
      score: 58,
      label: 'medium',
      name: 'Fox Corporation',
      type: 'Media company',
      explanation: 'Fox News is assigned a medium score in this prototype.'
    },
    'breitbart.com': {
      score: 32,
      label: 'low',
      name: 'Breitbart News Network',
      type: 'Independent media outlet',
      explanation: 'This prototype assigns Breitbart a low domain-reputation score.'
    },
    'infowars.com': {
      score: 12,
      label: 'low',
      name: 'InfoWars',
      type: 'Independent media outlet',
      explanation: 'This prototype assigns InfoWars a low domain-reputation score.'
    },
    'theonion.com': {
      score: 10,
      label: 'low',
      name: 'The Onion',
      type: 'Satire publication',
      explanation: 'The Onion is satire and is not a factual-news source.'
    }
  };

  function parseDate(value) {
    if (!value) return null;
    const rawValue = String(value).trim();
    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnlyMatch
      ? new Date(Date.UTC(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3])))
      : new Date(rawValue);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getDomainName(article) {
    const rawDomain = article.domain || article.canonicalUrl || '';

    try {
      return new URL(rawDomain.includes('://') ? rawDomain : `https://${rawDomain}`)
        .hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return String(rawDomain).replace(/^www\./, '').toLowerCase();
    }
  }

  function buildReliability(domain) {
    const match = Object.entries(reputation).find(([knownDomain]) =>
      domain === knownDomain || domain.endsWith(`.${knownDomain}`)
    );

    if (!match) {
      return {
        score: 55,
        label: 'medium',
        explanation: 'No prototype reputation entry exists for this domain; the default score is not an independent fact check.',
        owner: {
          name: domain || 'Unknown source',
          type: 'Unclassified publisher',
          description: 'Publisher ownership is not verified by this local analysis.'
        }
      };
    }

    const [knownDomain, source] = match;
    return {
      score: source.score,
      label: source.label,
      explanation: source.explanation,
      owner: {
        name: source.name,
        type: source.type,
        description: `${source.name} is the prototype-listed publisher for ${knownDomain}.`
      }
    };
  }

  function buildFreshness(article, now) {
    const parsedUpdatedDate = parseDate(article.updatedDate);
    const published = parseDate(article.publishDate);
    const updated = parsedUpdatedDate && (!published || parsedUpdatedDate >= published)
      ? parsedUpdatedDate
      : null;
    const effectiveDate = updated || published;
    const updateDateSource = updated ? 'updated' : published ? 'published' : null;
    if (!effectiveDate) {
      return {
        status: 'unknown',
        factDate: null,
        score: null,
        updateDate: null,
        updateDateSource: null,
        publishAgeDays: null,
        explanation: 'No valid update or publication date was found, so an update recency score cannot be calculated.'
      };
    }

    const currentDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const updateDate = new Date(Date.UTC(effectiveDate.getUTCFullYear(), effectiveDate.getUTCMonth(), effectiveDate.getUTCDate()));
    const publishAgeDays = Math.floor((currentDate - updateDate) / dayMilliseconds);

    if (publishAgeDays < 0) {
      return {
        status: 'unknown',
        factDate: null,
        score: null,
        updateDate: effectiveDate.toISOString().slice(0, 10),
        updateDateSource,
        publishAgeDays,
        explanation: 'The last update date is in the future, so an update recency score cannot be calculated.'
      };
    }

    const score = Math.max(0, Math.round(100 * (1 - Math.min(publishAgeDays, freshnessWindowDays) / freshnessWindowDays)));
    const status = score > 0 ? 'fresh' : 'stale';
    const recency = publishAgeDays === 0 ? 'today' : `${publishAgeDays} ${publishAgeDays === 1 ? 'day' : 'days'} ago`;
    const dateLabel = updateDateSource === 'updated' ? 'Updated' : 'Published';

    return {
      status,
      factDate: null,
      score,
      updateDate: updateDate.toISOString().slice(0, 10),
      updateDateSource,
      publishAgeDays,
      explanation: `${dateLabel} ${recency}. The score measures how recently the article was updated; publication date is used when no update date is available.`
    };
  }

  function addTermCounts(text, weight, counts) {
    const words = String(text || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
    words.forEach((word) => {
      const normalized = word.replace(/^['-]+|['-]+$/g, '');
      if (normalized.length < 4 || stopWords.has(normalized)) return;
      counts.set(normalized, (counts.get(normalized) || 0) + weight);
    });
  }

  function buildTopics(article) {
    const counts = new Map();
    const title = String(article.title || '');
    const body = String(article.mainText || '');
    addTermCounts(title, 4, counts);
    addTermCounts(body.slice(0, 600), 2, counts);
    addTermCounts(body.slice(600, 3600), 1, counts);

    const topics = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([label, score]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        confidence: Math.min(0.95, 0.5 + score * 0.015)
      }));

    return topics.length ? topics : [{ label: 'General news', confidence: 0.5 }];
  }

  function buildSummary(article) {
    const sourceText = String(article.mainText || article.title || '').trim();
    const firstSentence = sourceText.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
    if (firstSentence) return firstSentence;

    const excerpt = sourceText.slice(0, 240).trim().replace(/[,;:]\s*$/, '');
    return excerpt ? `${excerpt}.` : 'A summary is not available for this article.';
  }

  function analyzeArticle(article, now = new Date()) {
    const domain = getDomainName(article || {});
    const safeArticle = article || {};
    const topics = buildTopics(safeArticle);

    return {
      summary: buildSummary(safeArticle),
      freshness: buildFreshness(safeArticle, now),
      reliability: buildReliability(domain),
      topics,
      followUps: [
        { type: 'article', label: 'Follow this story' },
        ...topics.slice(0, 2).map((topic) => ({ type: 'theme', label: topic.label }))
      ],
      analysisSource: 'local'
    };
  }

  const analyzer = { analyzeArticle };
  root.articleAnalyzer = analyzer;
  if (typeof module !== 'undefined' && module.exports) module.exports = analyzer;
})(globalThis);