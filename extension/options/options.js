const API_KEY_STORAGE_KEY = 'geminiApiKey';
const MODEL_STORAGE_KEY = 'geminiModel';
const DEFAULT_MODEL = 'gemini-2.0-flash';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm');
  const apiKeyInput = document.getElementById('apiKey');
  const modelInput = document.getElementById('model');
  const status = document.getElementById('status');
  const toggleKeyButton = document.getElementById('toggleKey');
  const removeKeyButton = document.getElementById('removeKey');

  const settings = await chrome.storage.local.get([API_KEY_STORAGE_KEY, MODEL_STORAGE_KEY]);
  apiKeyInput.value = settings[API_KEY_STORAGE_KEY] || '';
  modelInput.value = settings[MODEL_STORAGE_KEY] || DEFAULT_MODEL;

  const clearAnalysisCache = async () => {
    const stored = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(stored).filter((key) => key.startsWith('analysis-cache-'));
    if (cacheKeys.length) await chrome.storage.local.remove(cacheKeys);
  };

  toggleKeyButton.addEventListener('click', () => {
    const reveal = apiKeyInput.type === 'password';
    apiKeyInput.type = reveal ? 'text' : 'password';
    toggleKeyButton.textContent = reveal ? 'Hide' : 'Show';
    toggleKeyButton.setAttribute('aria-pressed', String(reveal));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    const model = modelInput.value.trim() || DEFAULT_MODEL;
    await chrome.storage.local.set({
      [API_KEY_STORAGE_KEY]: apiKey,
      [MODEL_STORAGE_KEY]: model
    });
    await clearAnalysisCache();
    status.textContent = apiKey
      ? 'Settings saved. Reload an article tab to run Gemini analysis.'
      : 'Settings saved. The extension will use local analysis.';
  });

  removeKeyButton.addEventListener('click', async () => {
    apiKeyInput.value = '';
    await chrome.storage.local.remove(API_KEY_STORAGE_KEY);
    await clearAnalysisCache();
    status.textContent = 'API key removed. The extension will use local analysis.';
  });
});