(() => {
  const defaults = {
    theme: "system",
    defaultUrl: "https://jsonplaceholder.typicode.com/posts/1",
    defaultHeaders: [{ key: "Accept", value: "application/json" }],
    defaultQuery: [],
    defaultBody: "",
    restoreLast: true,
    timeoutMs: 15000,
    historySize: 8,
    historyEnabled: true,
    favorites: [],
    activeEnvironment: "",
  };

  function clampHistorySize(size) {
    const num = Number(size);
    if (!Number.isFinite(num)) return defaults.historySize;
    return Math.max(0, Math.min(50, Math.floor(num)));
  }

  window.clampTimeoutMs = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.max(1000, Math.min(60000, Math.round(number))) : defaults.timeoutMs;
  };
  window.DEFAULT_OPTIONS = defaults;
  window.clampHistorySize = clampHistorySize;
})();
