/** @jest-environment node */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
let listener, fetchMock;
const sender = { id: 'test-extension', url: 'chrome-extension://test-extension/popup.html' };
const payload = { requestId: 'one', method: 'GET', url: 'https://example.com', headers: {}, timeoutMs: 1000 };
beforeEach(() => {
  fetchMock = jest.fn();
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8'), {
    chrome: { runtime: { id: sender.id, getURL: () => 'chrome-extension://test-extension/', onMessage: { addListener: fn => { listener = fn; } } } },
    fetch: fetchMock, URL, Headers, TextEncoder, TextDecoder, AbortController, performance, setTimeout, clearTimeout,
  });
});
const send = (overrides = {}) => new Promise(resolve => listener({ type: 'api-request', payload: { ...payload, ...overrides } }, sender, resolve));
test('rejects malformed messages and unsupported protocols without fetching', async () => {
  const reply = jest.fn();
  listener({ type: 'api-request' }, sender, reply);
  expect(reply.mock.calls[0][0].ok).toBe(false);
  expect((await send({ url: 'file:///etc/passwd' })).ok).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
test('ignores messages from web pages', () => {
  listener({ type: 'api-request', payload }, { ...sender, url: 'https://evil.example' }, jest.fn());
  expect(fetchMock).not.toHaveBeenCalled();
});
test('returns HTTP errors as responses and measures Unicode bytes', async () => {
  fetchMock.mockResolvedValue(new Response('ą', { status: 400 }));
  const result = await send();
  expect(result).toMatchObject({ ok: true, status: 400, body: 'ą', bodyBytes: 2 });
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
});
test('cancellation differs from timeout and releases the request ID', async () => {
  fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  const pending = send();
  listener({ type: 'cancel-request', payload: { requestId: 'one' } }, sender, jest.fn());
  expect(await pending).toMatchObject({ ok: false, cancelled: true, error: 'Request cancelled' });
  fetchMock.mockResolvedValue(new Response('next'));
  expect((await send()).body).toBe('next');
});
test('timeout aborts a stalled request', async () => {
  jest.useFakeTimers();
  // Reload with fake timers in the worker context.
  const code = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');
  vm.runInNewContext(code, { chrome: { runtime: { id: sender.id, getURL: () => 'chrome-extension://test-extension/', onMessage: { addListener: fn => { listener = fn; } } } }, fetch: fetchMock, URL, Headers, TextEncoder, TextDecoder, AbortController, performance, setTimeout, clearTimeout });
  fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  const pending = send();
  await jest.advanceTimersByTimeAsync(1000);
  expect(await pending).toMatchObject({ ok: false, cancelled: false, error: 'Request timed out after 1s' });
  jest.useRealTimers();
});
test('rejects duplicate request IDs without replacing the original controller', async () => {
  fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  const first = send();
  expect((await send()).error).toMatch(/already in use/);
  listener({ type: 'cancel-request', payload: { requestId: 'one' } }, sender, jest.fn());
  expect((await first).cancelled).toBe(true);
});
test('bounds streamed responses and cancels oversized bodies', async () => {
  const cancel = jest.fn();
  let chunks = 0;
  fetchMock.mockResolvedValue(new Response(new ReadableStream({ pull(controller) { chunks++; controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel })));
  const result = await send();
  expect(result).toMatchObject({ ok: false, error: 'Response exceeds the 5 MiB limit' });
  expect(cancel).toHaveBeenCalled();
  expect(chunks).toBeLessThan(9);
});
