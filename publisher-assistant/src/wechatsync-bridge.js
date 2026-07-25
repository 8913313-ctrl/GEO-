(function () {
  'use strict';

  window.__tongzhuoBridgeReady = true;

  function sendToPage(payload) {
    window.postMessage({ source: 'tongzhuo-wechatsync', ...payload }, '*');
  }

  window.addEventListener('message', function (event) {
    const message = event.data && typeof event.data === 'object' ? event.data : null;
    if (!message || message.source === 'tongzhuo-wechatsync') return;

    if (message.type === 'TONGZHUO_PING') {
      sendToPage({ type: 'TONGZHUO_BRIDGE_READY' });
      return;
    }

    if (message.type === 'TONGZHUO_START_SYNC') {
      chrome.runtime.sendMessage({
        type: 'START_SYNC_FROM_EDITOR',
        article: message.article || {},
        platforms: Array.isArray(message.platforms) ? message.platforms : [],
      }).then(function (result) {
        sendToPage({ type: 'TONGZHUO_SYNC_RESULT', result: result || {} });
      }).catch(function (error) {
        sendToPage({ type: 'TONGZHUO_SYNC_ERROR', error: error?.message || String(error) });
      });
    }

    if (message.type === 'TONGZHUO_GET_PLATFORMS') {
      chrome.runtime.sendMessage({ type: 'GET_PLATFORMS' }).then(function (result) {
        sendToPage({ type: 'TONGZHUO_PLATFORMS_RESULT', result: result || {} });
      }).catch(function (error) {
        sendToPage({ type: 'TONGZHUO_SYNC_ERROR', error: error?.message || String(error) });
      });
    }
  });

  chrome.runtime.onMessage.addListener(function (message) {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'SYNC_PROGRESS' || message.type === 'SYNC_COMPLETED' || message.type === 'SYNC_ERROR') {
      sendToPage({ type: `TONGZHUO_${message.type}`, result: message.result || message.payload || null, error: message.error || null });
    }
  });
})();
