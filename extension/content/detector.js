(function () {
  let lastArticleKey = '';
  let detectionTimer = null;

  function detectAndSend() {
    const article = window.articleDetector?.detectArticle?.();
    const articleKey = article
      ? `${article.canonicalUrl}|${article.title}|${article.mainText.length}`
      : `none|${window.location.href}`;

    if (articleKey === lastArticleKey) {
      return;
    }

    lastArticleKey = articleKey;
    chrome.runtime.sendMessage({ article: article || null });
  }

  function scheduleDetection() {
    clearTimeout(detectionTimer);
    detectionTimer = setTimeout(detectAndSend, 800);
  }

  detectAndSend();

  const observer = new MutationObserver(scheduleDetection);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      scheduleDetection();
    }
  }, 1000);
})();
