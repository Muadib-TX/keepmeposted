(function () {
  const article = window.articleDetector?.detectArticle?.();

  chrome.runtime.sendMessage({ article: article || null });
})();
