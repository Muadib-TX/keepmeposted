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

function buildGeminiPrompt(article) {
  return `You are helping build a news freshness checker prototype. Analyze the following article payload and return ONLY valid JSON with this exact structure:

{
  "status": "fresh" | "stale" | "unknown",
  "factDate": "YYYY-MM-DD" | null,
  "explanation": "A short one- or two-sentence explanation"
}

Guidance:
- Identify the primary factual event being reported.
- Estimate when that event actually occurred.
- Compare that event date with the article publish date.
- If the article looks like it is presenting an old event as new, return status: "stale".
- If the article is current and does not appear stale, return status: "fresh".
- If the article lacks enough information, return status: "unknown".

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
    return {
      freshness: ensureValidFreshnessObject(parsed),
      reliability: buildFallbackReliability(article.domain)
    };
  } catch (error) {
    console.error('Gemini integration failed:', error.message);
    return null;
  }
}

async function buildResponse(article) {
  const canonicalUrl = String(article.canonicalUrl || article.domain || '').toLowerCase();
  const matchedPattern = MOCK_DATA.patterns.find((pattern) => canonicalUrl.includes(pattern.match.toLowerCase()));

  if (GEMINI_API_KEY) {
    const geminiAnalysis = await analyzeWithGemini(article);

    if (geminiAnalysis) {
      return geminiAnalysis;
    }
  }

  if (matchedPattern) {
    return {
      freshness: matchedPattern.freshness,
      reliability: matchedPattern.reliability
    };
  }

  return {
    freshness: buildFallbackFreshness(article),
    reliability: buildFallbackReliability(article.domain)
  };
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
