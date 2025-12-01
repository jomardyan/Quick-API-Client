const DEFAULT_OPTIONS = {
  theme: "system",
  defaultUrl: "https://jsonplaceholder.typicode.com/posts/1",
  defaultHeaders: [{ key: "Accept", value: "application/json" }],
  defaultQuery: [],
  defaultBody: "",
  restoreLast: true,
};

const themeSelect = document.getElementById("themeSelect");
const defaultUrl = document.getElementById("defaultUrl");
const defaultHeaders = document.getElementById("defaultHeaders");
const defaultQuery = document.getElementById("defaultQuery");
const defaultBody = document.getElementById("defaultBody");
const restoreLast = document.getElementById("restoreLast");
const status = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");

function applyTheme(theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.body.dataset.theme = resolved;
}

function parseKVText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          key: item.key?.trim?.() || "",
          value: item.value ?? "",
        }))
        .filter((kv) => kv.key);
    }
  } catch (err) {
    // Fallback to newline parsing.
  }
  return trimmed
    .split("\n")
    .map((line) => {
      const [key, ...rest] = line.split(":");
      if (!key) return null;
      return { key: key.trim(), value: rest.join(":").trim() };
    })
    .filter((kv) => kv && kv.key);
}

function kvToDisplay(kvList) {
  if (!kvList || !kvList.length) return "";
  return JSON.stringify(kvList, null, 2);
}

function loadOptions() {
  chrome.storage.sync.get("options", ({ options }) => {
    const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };
    themeSelect.value = merged.theme;
    defaultUrl.value = merged.defaultUrl;
    defaultHeaders.value = kvToDisplay(merged.defaultHeaders);
    defaultQuery.value = kvToDisplay(merged.defaultQuery);
    defaultBody.value = merged.defaultBody || "";
    restoreLast.checked = merged.restoreLast;
    applyTheme(merged.theme);
  });
}

function saveOptions() {
  const options = {
    theme: themeSelect.value,
    defaultUrl: defaultUrl.value.trim(),
    defaultHeaders: parseKVText(defaultHeaders.value),
    defaultQuery: parseKVText(defaultQuery.value),
    defaultBody: defaultBody.value,
    restoreLast: restoreLast.checked,
  };
  chrome.storage.sync.set({ options }, () => {
    status.textContent = "Saved.";
    applyTheme(options.theme);
    setTimeout(() => (status.textContent = ""), 1800);
  });
}

function resetOptions() {
  chrome.storage.sync.set({ options: DEFAULT_OPTIONS }, loadOptions);
  status.textContent = "Reset to defaults.";
  setTimeout(() => (status.textContent = ""), 1800);
}

document.addEventListener("DOMContentLoaded", loadOptions);
saveBtn.addEventListener("click", saveOptions);
resetBtn.addEventListener("click", resetOptions);

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  applyTheme(themeSelect.value);
});
