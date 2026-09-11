const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const pendingRequests = new Map();

async function readResponse(res) {
  if (!res.body) return { body: "", bodyBytes: 0 };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let bodyBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyBytes += value.byteLength;
      if (bodyBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Response exceeds the 5 MiB limit");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return { body: chunks.join(""), bodyBytes };
  } finally {
    reader.releaseLock();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only extension pages may use the network bridge.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(""))) return;
  if (message?.type === "cancel-request") {
    const request = pendingRequests.get(message.payload?.requestId);
    if (request && request.owner === sender.url) {
      request.cancelled = true;
      request.controller.abort();
    }
    sendResponse({ ok: true });
    return;
  }
  if (message?.type !== "api-request") return;
  const payload = message.payload;
  let parsedUrl;
  try {
    if (!payload || typeof payload.requestId !== "string" || !payload.requestId || payload.requestId.length > 128) throw new Error("Invalid request ID");
    if (pendingRequests.has(payload.requestId)) throw new Error("Request ID already in use");
    if (pendingRequests.size >= 8) throw new Error("Too many active requests");
    parsedUrl = new URL(payload.url);
    if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) throw new Error("Only HTTP and HTTPS URLs without embedded credentials are supported");
    if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(payload.method)) throw new Error("Unsupported HTTP method");
    if (payload.body != null && typeof payload.body !== "string") throw new Error("Invalid request body");
    if (payload.body && new TextEncoder().encode(payload.body).length > MAX_RESPONSE_BYTES) throw new Error("Request exceeds the 5 MiB limit");
    new Headers(payload.headers); // Validate before allocating request resources.
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
    return;
  }
  const { method, headers, body, requestId } = payload;
  const timeoutMs = Number.isFinite(payload.timeoutMs) && payload.timeoutMs > 0
    ? Math.min(60000, Math.max(1000, payload.timeoutMs)) : DEFAULT_TIMEOUT_MS;
  const request = { controller: new AbortController(), cancelled: false, owner: sender.url };
  pendingRequests.set(requestId, request);
  const timeout = setTimeout(() => request.controller.abort(), timeoutMs);
  const started = performance.now();
  (async () => {
    try {
      const options = { method, headers, signal: request.controller.signal, credentials: "omit", cache: "no-store" };
      if (!["GET", "HEAD"].includes(method) && body != null) options.body = body;
      const res = await fetch(parsedUrl.href, options);
      const result = await readResponse(res);
      sendResponse({
        ok: true, status: res.status, statusText: res.statusText, url: res.url,
        type: res.type, elapsed: Math.round(performance.now() - started),
        headers: Array.from(res.headers.entries()), ...result,
      });
    } catch (err) {
      sendResponse({
        ok: false, cancelled: request.cancelled,
        error: request.cancelled ? "Request cancelled" : request.controller.signal.aborted
          ? `Request timed out after ${timeoutMs / 1000}s`
          : err.message || "Network request failed",
        elapsed: Math.round(performance.now() - started),
      });
    } finally {
      clearTimeout(timeout);
      if (pendingRequests.get(requestId) === request) pendingRequests.delete(requestId);
    }
  })();
  return true;
});
