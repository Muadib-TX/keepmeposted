(function () {
  function readText(node) {
    if (!node) return '';

    return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeUrl(rawUrl) {
    if (!rawUrl) return '';

    try {
      return new URL(rawUrl, window.location.href).toString();
    } catch (error) {
      return rawUrl;
    }
  }

  function findJsonLdNewsArticle() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || '');
        const stack = [parsed];

        while (stack.length) {
          const current = stack.pop();

          if (!current || typeof current !== 'object') continue;

          if (current['@type'] === 'NewsArticle' || current['@type'] === 'Article') {
            return current;
          }

          Object.values(current).forEach((value) => {
            if (value && typeof value === 'object') {
              stack.push(value);
            }
          });
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  function extractPublishDate(ldJson) {
    const datePublished = ldJson?.datePublished || null;

    if (datePublished) {
      return datePublished;
    }

    const metaPublished = document.querySelector('meta[property="article:published_time"]')?.content;
    return metaPublished || null;
  }

  function findLargestTextBlock() {
    const elements = Array.from(document.querySelectorAll('article, section, div'));
    let bestBlock = null;
    let bestLength = 0;

    for (const element of elements) {
      const text = readText(element);
      const textLength = text.length;

      if (textLength > bestLength) {
        bestLength = textLength;
        bestBlock = element;
      }
    }

    return bestBlock || document.body;
  }

  function findTitle() {
    const metaOgTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (metaOgTitle) return metaOgTitle;

    const titleTag = document.querySelector('title')?.textContent;
    if (titleTag) return titleTag;

    const h1 = document.querySelector('h1')?.textContent;
    return h1 || 'Untitled article';
  }

  function findCanonicalUrl() {
    const canonicalLink = document.querySelector('link[rel="canonical"]')?.href;
    if (canonicalLink) {
      return normalizeUrl(canonicalLink);
    }

    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  function findIsoDateInPage() {
    const text = document.body.innerText || '';
    const match = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    return match ? match[0] : null;
  }

  function isLikelyArticlePage() {
    // Heuristic-based detection: prefer structured metadata, then semantic article markers,
    // then content-size and URL path clues for a lightweight, zero-interaction prototype.
    const ldJson = findJsonLdNewsArticle();
    if (ldJson) {
      return true;
    }

    const ogType = document.querySelector('meta[property="og:type"]')?.content;
    if (ogType && ogType.toLowerCase().includes('article')) {
      return true;
    }

    const articleTag = document.querySelector('article');
    if (articleTag) {
      const text = readText(articleTag);
      if (text.length > 400) {
        return true;
      }
    }

    const path = window.location.pathname.toLowerCase();
    const newsPathPatterns = ['news', 'article', 'story', '/2026/', '/2025/', '/2024/', '/2023/'];

    if (newsPathPatterns.some((pattern) => path.includes(pattern))) {
      return true;
    }

    return false;
  }

  function extractArticle() {
    if (!isLikelyArticlePage()) {
      return null;
    }

    const ldJson = findJsonLdNewsArticle();
    const articleNode = document.querySelector('article') || findLargestTextBlock();
    const mainText = readText(articleNode);

    if (!mainText || mainText.length < 120) {
      return null;
    }

    const publishDate = extractPublishDate(ldJson) || findIsoDateInPage();

    return {
      title: findTitle(),
      publishDate,
      mainText,
      domain: window.location.hostname,
      canonicalUrl: findCanonicalUrl()
    };
  }

  window.articleDetector = {
    detectArticle: extractArticle,
    isLikelyArticlePage
  };
})();
