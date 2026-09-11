const win = require('./load-popup')();
const element = id => document.getElementById(id);
const callbacks = [];
const response = body => ({ ok: true, status: 200, statusText: 'OK', type: 'basic', elapsed: 10, url: 'https://example.com/', headers: [], body });
beforeEach(() => {
  win.cancelCurrentRequest();
  callbacks.length = 0;
  chrome.runtime.sendMessage.mockImplementation((message, callback) => {
    if (message.type === 'api-request') callbacks.push({ message, callback });
    else callback({ ok: true });
  });
  element('url').value = 'https://example.com/';
  win.setGqlMode(false);
  element('method').value = 'POST';
  element('body').value = 'original';
  chrome.permissions.request.mockImplementation((origins, cb) => cb(true));
});
afterAll(() => win.cancelCurrentRequest());

test('late cancelled response cannot replace a new request or re-enable Send', async () => {
  await win.sendRequest();
  const old = callbacks[0];
  win.cancelCurrentRequest();
  await win.sendRequest();
  old.callback(response('stale'));
  expect(element('sendBtn').disabled).toBe(true);
  expect(element('responseBody').textContent).not.toBe('stale');
  callbacks[1].callback(response('latest'));
  expect(element('responseBody').textContent).toBe('latest');
  expect(element('sendBtn').disabled).toBe(false);
});
test('permission wait is locked against duplicate sends and can be cancelled', async () => {
  let grant;
  chrome.permissions.request.mockImplementation((origins, cb) => { grant = cb; });
  const pending = win.sendRequest();
  await win.sendRequest();
  win.cancelCurrentRequest();
  grant(true);
  await pending;
  expect(callbacks).toHaveLength(0);
  expect(element('sendBtn').disabled).toBe(false);
});
test('history stores the submitted draft, not edits made while waiting', async () => {
  await win.sendRequest();
  element('body').value = 'edited';
  callbacks[0].callback(response('ok'));
  const historyWrite = chrome.storage.local.set.mock.calls.filter(([data]) => data.history).pop()[0];
  expect(historyWrite.history[0].body).toBe('original');
});
test('GraphQL cURL and outgoing request have the same body', async () => {
  element('gqlVariables').value = '{"id":1}';
  win.setGqlMode(true);
  element('body').value = '{ users { id } }';
  await win.sendRequest();
  const payload = callbacks[0].message.payload;
  expect(win.buildCurl()).toContain(win.shellEscape(payload.body));
  expect(payload.method).toBe('POST');
  expect(element('method').disabled).toBe(true);
});
test('large JSON uses plain text rendering and keeps the raw response', async () => {
  await win.sendRequest();
  const raw = JSON.stringify({ value: 'a'.repeat(210000) });
  callbacks[0].callback(response(raw));
  expect(element('responseBody').querySelectorAll('span')).toHaveLength(0);
  expect(element('responseBody').dataset.raw).toBe(raw);
});
test('authentication replacement preserves password spaces and avoids duplicate headers', () => {
  element('authType').value = 'basic';
  element('basicUsername').value = 'user';
  element('basicPassword').value = ' password ';
  win.applyAuthTemplate();
  element('authType').value = 'bearer';
  element('bearerToken').value = 'new-token';
  win.applyAuthTemplate();
  const headers = win.readKV(element('headers')).filter(h => h.key.toLowerCase() === 'authorization');
  expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer new-token' }]);
});
