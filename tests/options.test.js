const fs = require('fs');
const path = require('path');
document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, '../options.html'), 'utf8');
window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn() }));
let data;
chrome.storage.sync.get.mockImplementation((key, cb) => cb(data));
chrome.storage.sync.set.mockImplementation((update, cb) => { data = { ...data, ...update }; if (cb) cb(); });
window.eval(fs.readFileSync(path.join(__dirname, '../defaults.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(__dirname, '../options.js'), 'utf8'));
const el = id => document.getElementById(id);
beforeEach(() => {
  data = { options: { activeEnvironment: 'Test', favorites: [{ name: 'Keep me' }] }, environments: [{ name: 'Test', vars: [{ key: 'HOST', value: 'https://example.com' }] }] };
  window.loadOptions();
  window.loadEnvironments();
});
test('renaming an active environment keeps it selected', () => {
  el('envNameInput').value = 'Renamed';
  el('saveEnvBtn').click();
  expect(data.options.activeEnvironment).toBe('Renamed');
  expect(data.environments[0].name).toBe('Renamed');
  expect(el('status').textContent).toBe('Environment saved.');
});
test('duplicate environment names do not get saved', () => {
  data.environments.push({ name: 'Other', vars: [] });
  window.loadEnvironments();
  el('envNameInput').value = 'Other';
  el('saveEnvBtn').click();
  expect(el('status').textContent).toMatch(/already exists/);
  expect(data.environments[0].name).toBe('Test');
});
test('failed saves report failure without a success message', () => {
  chrome.storage.sync.set.mockImplementationOnce((update, cb) => {
    chrome.runtime.lastError = { message: 'Quota exceeded' };
    cb();
    delete chrome.runtime.lastError;
  });
  el('saveEnvBtn').click();
  expect(el('status').textContent).toMatch(/Env save failed/);
});
test('reset preferences preserves favorites', () => {
  window.resetOptions();
  expect(data.options.favorites).toEqual([{ name: 'Keep me' }]);
});
test('invalid numeric settings normalize to finite defaults', () => {
  expect(window.clampTimeoutMs(NaN)).toBe(15000);
  expect(window.clampHistorySize(3.8)).toBe(3);
});
