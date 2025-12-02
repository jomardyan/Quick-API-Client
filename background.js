const DEFAULT_TIMEOUT_MS = 15000;
const DEBUG_LOGGING = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "api-request") return;

  const { url, method, headers, body, timeoutMs } = message.payload;
  const effectiveTimeout =
    typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), effectiveTimeout);
  const started = performance.now();

  (async () => {
    try {
      const fetchOptions = {
        method,
        headers,
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      };

      if (body && !['GET', 'HEAD'].includes(method)) {
        fetchOptions.body = body;
      }

      if (DEBUG_LOGGING) console.log("Fetching", url, fetchOptions);
      const res = await fetch(url, fetchOptions);
      const text = await res.text();
      const elapsed = Math.round(performance.now() - started);
      const headersEntries = Array.from(res.headers.entries());

      if (DEBUG_LOGGING) console.log("Fetch success", res.status);
      sendResponse({
        ok: true,
        status: res.status,
        statusText: res.statusText,
        url: res.url,
        type: res.type,
        elapsed,
        headers: headersEntries,
        body: text,
      });
    } catch (err) {
      console.error('API request error:', err);
      sendResponse({
        ok: false,
        error:
          err.name === "AbortError"
            ? `Timed out after ${Math.round(effectiveTimeout / 1000)}s`
            : err.message,
      });
    } finally {
      clearTimeout(timeout);
    }
  })();

  return true; // keep the message channel open for async response
});
