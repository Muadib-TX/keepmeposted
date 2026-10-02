const assert = require('node:assert/strict');
const { analyzeArticle } = require('../extension/lib/articleAnalyzer.js');

const now = new Date('2026-10-01T12:00:00.000Z');
const article = {
  title: 'Transit funding expands city rail project',
  publishDate: '2026-09-28',
  updatedDate: '2026-09-30',
  mainText: 'The city approved new transit funding for a rail project. Transit officials said the project will connect neighborhoods.',
  domain: 'www.reuters.com',
  canonicalUrl: 'https://www.reuters.com/news/transit'
};

const recentAnalysis = analyzeArticle(article, now);
assert.equal(recentAnalysis.freshness.status, 'fresh');
assert.equal(recentAnalysis.freshness.score, 97);
assert.equal(recentAnalysis.freshness.updateDateSource, 'updated');
assert.equal(recentAnalysis.analysisSource, 'local');
assert.equal(recentAnalysis.reliability.label, 'high');
assert.ok(recentAnalysis.topics.some((topic) => topic.label.toLowerCase() === 'transit'));
assert.match(recentAnalysis.freshness.explanation, /score measures how recently/i);

const olderAnalysis = analyzeArticle({ ...article, publishDate: '2026-08-01', updatedDate: null }, now);
assert.equal(olderAnalysis.freshness.status, 'stale');
assert.equal(olderAnalysis.freshness.score, 0);
assert.equal(olderAnalysis.freshness.updateDate, '2026-08-01');

const publishDateFallback = analyzeArticle({ ...article, updatedDate: null, publishDate: '2026-09-01' }, now);
assert.equal(publishDateFallback.freshness.score, 0);
assert.equal(publishDateFallback.freshness.updateDateSource, 'published');

const undatedAnalysis = analyzeArticle({ ...article, publishDate: null, updatedDate: null }, now);
assert.equal(undatedAnalysis.freshness.status, 'unknown');
assert.equal(undatedAnalysis.freshness.score, null);

console.log('Local analyzer checks passed.');