'use strict';

const { contextBridge } = require('electron');

// The renderer never receives the raw local token. Electron injects the
// header at the session level for requests to the exact local origin.
contextBridge.exposeInMainWorld('tongzhuoAgent', Object.freeze({
  requestHeaders: () => Object.freeze({}),
}));
