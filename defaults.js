const DEFAULT_OPTIONS = {
  theme: "system",
  defaultUrl: "https://jsonplaceholder.typicode.com/posts/1",
  defaultHeaders: [{ key: "Accept", value: "application/json" }],
  defaultQuery: [],
  defaultBody: "",
  restoreLast: true,
  timeoutMs: 15000,
  historySize: 8,
  historyEnabled: true,
};

function clampHistorySize(size) {
  const num = Number(size);
  if (!Number.isFinite(num)) return DEFAULT_OPTIONS.historySize;
  return Math.max(0, Math.min(50, num));
}
