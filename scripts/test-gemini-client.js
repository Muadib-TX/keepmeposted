const assert = require('node:assert/strict');
global.articleAnalyzer = require('../extension/lib/articleAnalyzer.js');
const { analyzeArticle } = require('../extension/lib/analysisClient.js');

const article = {
  title: 'Transit plan announced',
  publishDate: '2026-10-01',
  mainText: 'Officials announced a new transit plan today.',
  domain: 'example.com',
  canonicalUrl: 'https://example.com/news/transit?private=value'
};

async function run() {
  let requestUrl;
  let requestOptions;
  global.chrome = {
    storage: {
      local: {
        get: async () => ({ geminiApiKey: 'local-test-key', geminiModel: 'gemini-test-model' })
      }
    }
  };
  global.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                summary: 'Officials announced a new transit plan today.',
                freshness: { status: 'fresh', factDate: '2026-10-01', explanation: 'The event is current.' },
                reliability: {
                  score: 80,
                  label: 'high',
                  explanation: 'Established source.',
                  owner: { name: 'Example News', type: 'Publisher', description: 'Publisher details.' }
                },
                topics: [{ label: 'Transit', confidence: 0.9 }]
              })
            }]
          }
        }]
      })
    };
  };

  const remoteAnalysis = await analyzeArticle(article);
  assert.equal(remoteAnalysis.analysisSource, 'gemini');
  assert.equal(remoteAnalysis.topics[0].label, 'Transit');
  assert.equal(requestOptions.headers['x-goog-api-key'], 'local-test-key');
  assert.ok(requestUrl.includes('gemini-test-model:generateContent'));
  assert.ok(!requestOptions.body.includes(article.canonicalUrl));
  assert.ok(requestOptions.body.includes(article.mainText));

  global.chrome.storage.local.get = async () => ({});
  const localAnalysis = await analyzeArticle(article);
  assert.equal(localAnalysis.analysisSource, 'local');

  global.chrome.storage.local.get = async () => ({ geminiApiKey: 'local-test-key' });
  global.fetch = async () => ({ ok: false, status: 403 });
  const originalWarn = console.warn;
  console.warn = () => {};
  const fallbackAnalysis = await analyzeArticle(article);
  console.warn = originalWarn;
  assert.equal(fallbackAnalysis.analysisSource, 'local-fallback');

  console.log('Gemini client checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});