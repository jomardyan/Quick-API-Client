const fs = require('fs');
const path = require('path');

module.exports = function loadPopup() {
  document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, '../popup.html'), 'utf8');
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn() }));
  window.crypto.randomUUID = require('crypto').randomUUID;
  chrome.storage.sync.get.mockImplementation((keys, cb) => cb({}));
  chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));
  chrome.storage.local.set.mockImplementation((data, cb) => { if (cb) cb(); });
  chrome.storage.sync.set.mockImplementation((data, cb) => { if (cb) cb(); });
  chrome.permissions.request.mockImplementation((origins, cb) => cb(true));
  for (const file of ['defaults.js', 'popup/request.js', 'popup.js']) {
    window.eval(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
  }
  return window;
};
