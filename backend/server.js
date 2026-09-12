const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MOCK_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'mockData.json'), 'utf8')
);

const DOMAIN_REPUTATION = {
  'reuters.com': { score: 90, label: 'high', explanation: 'Reuters is modeled as a high-reliability wire service.' },
  'apnews.com': { score: 88, label: 'high', explanation: 'The Associated Press is modeled as a high-reliability source.' },
  'nytimes.com': { score: 76, label: 'medium', explanation: 'The New York Times is modeled as a generally credible source.' },
  'cnn.com': { score: 68, label: 'medium', explanation: 'CNN is modeled as a medium-reliability source in this prototype.' },
  'foxnews.com': { score: 58, label: 'medium', explanation: 'Fox News is modeled as a medium-reliability source in this prototype.' },
  'breitbart.com': { score: 32, label: 'low', explanation: 'Breitbart is modeled as a low-reliability source for this prototype.' },
  'infowars.com': { score: 12, label: 'low', explanation: 'Infowars is modeled as a low-reliability source for this prototype.' },
  'theonion.com': { score: 10, label: 'low', explanation: 'The Onion is modeled as a low-reliability satire source.' }
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function normalizeDomain(domain) {
  return String(domain || '').replace(/^www\./, '').toLowerCase();
}

function buildTopics(article) {
  const combinedText = `${article.title || ''} ${article.mainText || ''}`.toLowerCase();
  const words = combinedText.match(/[a-z0-9]{4,}/g) || [];
  const stopWords = new Set([
    'about', 'after', 'again', 'against', 'all', 'also', 'because', 'been', 'before', 'being', 'between',
    'from', 'have', 'into', 'more', 'most', 'other', 'over', 'same', 'some', 'such', 'that', 'their',
    'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'very', 'were', 'what',
    'when', 'where', 'which', 'while', 'with', 'would', 'your', 'article', 'story', 'news', 'said', 'will'
  ]);

  const counts = new Map();

  words.forEach((word) => {
    if (stopWords.has(word)) {
      return;
    }

    counts.set(word, (counts.get(word) || 0) + 1);
  });

  const topics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count], index) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      confidence: Math.min(0.95, 0.55 + (count * 0.08) + index * 0.05)
    }));

  return topics.length ? topics : [{ label: 'General news', confidence: 0.5 }];
}

function buildFollowUps(article, topics) {
  const headline = article.title || 'this article';
  const topicSuggestions = topics.slice(0, 2).map((topic) => ({
    type: 'theme',
    label: `Subscribe to theme: ${topic.label}`,
    description: `Receive future updates when ${topic.label.toLowerCase()} becomes relevant.`
  }));

  return [
    {
      type: 'article',
      label: `Subscribe to updates for ${headline}`,
      description: `Get a future update when ${headline} continues to develop.`
    },
    ...topicSuggestions
  ];
}

function buildDefaultAnalysis(article) {
  const topics = buildTopics(article);

  return {
    freshness: buildFallbackFreshness(article),
    reliability: buildFallbackReliability(article.domain),
    topics,
    followUps: buildFollowUps(article, topics)
  };
}

function ensureValidFreshnessObject(freshness) {
  return {
    status: freshness?.status || 'unknown',
    factDate: freshness?.factDate || null,
    explanation: freshness?.explanation || 'Freshness analysis did not include an explanation.'
  };
}

function buildFallbackFreshness(article) {
  const factDate = article.publishDate ? article.publishDate.slice(0, 10) : null;

  if (!factDate) {
    return {
      status: 'unknown',
      factDate: null,
      explanation: 'The article did not include a clear publish date, so the prototype could not infer freshness.'
    };
  }

  return {
    status: 'fresh',
    factDate,
    explanation: `The article was published on ${factDate} and appears to be describing a current event.`
  };
}

function buildFallbackReliability(domain) {
  const normalizedDomain = normalizeDomain(domain);
  const cached = DOMAIN_REPUTATION[normalizedDomain];

  if (cached) {
    return cached;
  }

  return {
    score: 55,
    label: 'medium',
    explanation: 'This domain is not in the prototype reputation table, so it is scored as medium reliability by default.'
  };
}

function normalizeReliability(reliability, domain) {
  const fallback = buildFallbackReliability(domain);

  if (!reliability || typeof reliability !== 'object') {
    return fallback;
  }

  return {
    score: Number.isInteger(reliability.score) ? reliability.score : fallback.score,
    label: ['high', 'medium', 'low'].includes(reliability.label) ? reliability.label : fallback.label,
    explanation: reliability.explanation || fallback.explanation
  };
}

function buildGeminiPrompt(article) {
  return `You are helping build a news freshness checker prototype. Analyze the following article payload and return ONLY valid JSON with this exact structure:

{
  "freshness": {
    "status": "fresh" | "stale" | "unknown",
    "factDate": "YYYY-MM-DD" | null,
    "explanation": "A short one- or two-sentence explanation"
  },
  "reliability": {
    "score": 0,
    "label": "high" | "medium" | "low",
    "explanation": "A short rationale for the domain trust score"
  },
  "topics": [
    { "label": "Topic label", "confidence": 0.0 }
  ],
  "followUps": [
    { "type": "article" | "theme", "label": "Action label", "description": "Short description" }
  ]
}

Guidance:
- Identify the primary factual event being reported.
- Estimate when that event actually occurred.
- Compare that event date with the article publish date.
- If the article looks like it is presenting an old event as new, set freshness.status to "stale".
- If the article is current and does not appear stale, set freshness.status to "fresh".
- If the article lacks enough information, set freshness.status to "unknown".
- Extract the top 2–5 themes or topics discussed in the article.
- Suggest 1–3 practical follow-up actions, including at least one article-level follow-up and one theme-level follow-up when possible.
- Keep explanations concise and useful for a browser extension popup.

Article payload:
${JSON.stringify(article, null, 2)}`;
}

function extractJson(text) {
  const fencedBlock = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedBlock && fencedBlock[1]) {
    return fencedBlock[1];
  }

  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0];
  }

  return text;
}

async function analyzeWithGemini(article) {
  if (!GEMINI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: buildGeminiPrompt(article) }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return null;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('') || '';

    if (!rawText) {
      return null;
    }

    const parsed = JSON.parse(extractJson(rawText));
    const normalizedFreshness = ensureValidFreshnessObject(parsed?.freshness || parsed);
    const normalizedReliability = normalizeReliability(parsed?.reliability, article.domain);
    const normalizedTopics = Array.isArray(parsed?.topics) && parsed.topics.length
      ? parsed.topics
      : buildTopics(article);
    const normalizedFollowUps = Array.isArray(parsed?.followUps) && parsed.followUps.length
      ? parsed.followUps
      : buildFollowUps(article, normalizedTopics);

    return {
      freshness: normalizedFreshness,
      reliability: normalizedReliability,
      topics: normalizedTopics,
      followUps: normalizedFollowUps
    };
  } catch (error) {
    console.error('Gemini integration failed:', error.message);
    return null;
  }
}

async function buildResponse(article) {
  const canonicalUrl = String(article.canonicalUrl || article.domain || '').toLowerCase();
  const matchedPattern = MOCK_DATA.patterns.find((pattern) => canonicalUrl.includes(pattern.match.toLowerCase()));
  const defaultAnalysis = buildDefaultAnalysis(article);

  if (GEMINI_API_KEY) {
    const geminiAnalysis = await analyzeWithGemini(article);

    if (geminiAnalysis) {
      return geminiAnalysis;
    }
  }

  if (matchedPattern) {
    return {
      freshness: matchedPattern.freshness,
      reliability: matchedPattern.reliability,
      topics: defaultAnalysis.topics,
      followUps: defaultAnalysis.followUps
    };
  }

  return defaultAnalysis;
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/analyze') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let body = '';

  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const article = JSON.parse(body || '{}');
      const response = await buildResponse(article);
      sendJson(res, 200, response);
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
    }
  });
});

server.listen(PORT, () => {
  console.log(
    `Freshness & Reliability backend is running on http://localhost:${PORT}${GEMINI_API_KEY ? ' with Gemini integration enabled' : ''}`
  );
});
