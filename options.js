const DEFAULT_OPTIONS = window.DEFAULT_OPTIONS;
const clampHistorySize =
  window.clampHistorySize ||
  ((size) => {
    const num = Number(size);
    if (!Number.isFinite(num)) return DEFAULT_OPTIONS.historySize;
    return Math.max(0, Math.min(50, num));
  });

const themeSelect = document.getElementById("themeSelect");
const defaultUrl = document.getElementById("defaultUrl");
const defaultHeaders = document.getElementById("defaultHeaders");
const defaultQuery = document.getElementById("defaultQuery");
const defaultBody = document.getElementById("defaultBody");
const restoreLast = document.getElementById("restoreLast");
const timeoutSeconds = document.getElementById("timeoutSeconds");
const historySize = document.getElementById("historySize");
const historyEnabled = document.getElementById("historyEnabled");
const status = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// Environment elements
const envNameSelect = document.getElementById("envNameSelect");
const envEditor = document.getElementById("envEditor");
const envNameInput = document.getElementById("envNameInput");
const envVarsInput = document.getElementById("envVarsInput");
const addEnvBtn = document.getElementById("addEnvBtn");
const deleteEnvBtn = document.getElementById("deleteEnvBtn");
const saveEnvBtn = document.getElementById("saveEnvBtn");

// Confirmation modal
const confirmModal = document.getElementById("confirmModal");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmModalOkBtn = document.getElementById("confirmModalOkBtn");
const confirmModalCancelBtn = document.getElementById("confirmModalCancelBtn");

let _confirmCallback = null;

function showConfirm(message, onOk) {
  confirmModalMessage.textContent = message;
  _confirmCallback = onOk;
  confirmModal.classList.add("show");
  document.body.style.overflow = "hidden";
  setTimeout(() => confirmModalOkBtn.focus(), 100);
}

function closeConfirmModal() {
  confirmModal.classList.remove("show");
  document.body.style.overflow = "";
  _confirmCallback = null;
}

confirmModalOkBtn.addEventListener("click", () => {
  const cb = _confirmCallback;
  closeConfirmModal();
  if (cb) cb();
});
confirmModalCancelBtn.addEventListener("click", closeConfirmModal);
confirmModal.addEventListener("click", (e) => {
  if (e.target === confirmModal) closeConfirmModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && confirmModal.classList.contains("show")) closeConfirmModal();
});

let environments = [];
let selectedEnvIdx = -1;

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
    const historySizeValue = clampHistorySize(merged.historySize);
    themeSelect.value = merged.theme;
    defaultUrl.value = merged.defaultUrl;
    defaultHeaders.value = kvToDisplay(merged.defaultHeaders);
    defaultQuery.value = kvToDisplay(merged.defaultQuery);
    defaultBody.value = merged.defaultBody || "";
    restoreLast.checked = merged.restoreLast;
    timeoutSeconds.value = Math.max(1, Math.round((merged.timeoutMs || 15000) / 1000));
    historySize.value = historySizeValue;
    historyEnabled.checked = merged.historyEnabled !== false;
    applyTheme(merged.theme);
  });
}

function saveOptions() {
  const timeoutMs = Math.max(1000, Math.min(60000, Number(timeoutSeconds.value) * 1000));
  const size = clampHistorySize(historySize.value);
  chrome.storage.sync.get("options", ({ options }) => {
    const existing = options || {};
    const newOptions = {
      ...DEFAULT_OPTIONS,
      ...existing,
      theme: themeSelect.value,
      defaultUrl: defaultUrl.value.trim(),
      defaultHeaders: parseKVText(defaultHeaders.value),
      defaultQuery: parseKVText(defaultQuery.value),
      defaultBody: defaultBody.value,
      restoreLast: restoreLast.checked,
      timeoutMs,
      historySize: size,
      historyEnabled: historyEnabled.checked,
    };
    chrome.storage.sync.set({ options: newOptions }, () => {
      if (chrome.runtime.lastError) {
        status.textContent = "Save failed: " + chrome.runtime.lastError.message;
        return;
      }
      status.textContent = "Saved.";
      applyTheme(newOptions.theme);
      setTimeout(() => (status.textContent = ""), 1800);
    });
  });
}

function resetOptions() {
  chrome.storage.sync.set({ options: DEFAULT_OPTIONS }, () => {
    loadOptions();
    status.textContent = "Reset to defaults.";
    setTimeout(() => (status.textContent = ""), 1800);
  });
}

function clearHistory() {
  chrome.storage.local.set({ history: [] }, () => {
    if (chrome.runtime.lastError) {
      status.textContent = "Error: " + chrome.runtime.lastError.message;
      return;
    }
    status.textContent = "History cleared.";
    setTimeout(() => (status.textContent = ""), 1800);
  });
}

// ── Environment management ────────────────────────────────────────────────────

function loadEnvironments() {
  chrome.storage.sync.get("environments", ({ environments: stored }) => {
    environments = stored || [];
    renderEnvSelect();
  });
}

function saveCurrentEnv() {
  if (selectedEnvIdx < 0 || selectedEnvIdx >= environments.length) return;
  environments[selectedEnvIdx].name = envNameInput.value.trim() || environments[selectedEnvIdx].name;
  environments[selectedEnvIdx].vars = parseKVText(envVarsInput.value);
  persistEnvironments();
}

function persistEnvironments(callback) {
  chrome.storage.sync.set({ environments }, () => {
    if (chrome.runtime.lastError) {
      status.textContent = "Env save failed: " + chrome.runtime.lastError.message;
      return;
    }
    if (callback) callback();
  });
}

function renderEnvSelect() {
  envNameSelect.innerHTML = "";
  if (!environments.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No environments yet — click + New";
    envNameSelect.appendChild(opt);
    envEditor.style.display = "none";
    selectedEnvIdx = -1;
    return;
  }
  environments.forEach((env, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = env.name || `Environment ${idx + 1}`;
    envNameSelect.appendChild(opt);
  });
  if (selectedEnvIdx < 0 || selectedEnvIdx >= environments.length) {
    selectedEnvIdx = 0;
  }
  envNameSelect.value = selectedEnvIdx;
  renderEnvEditor();
}

function renderEnvEditor() {
  if (selectedEnvIdx < 0 || selectedEnvIdx >= environments.length) {
    envEditor.style.display = "none";
    return;
  }
  const env = environments[selectedEnvIdx];
  envNameInput.value = env.name || "";
  envVarsInput.value = kvToDisplay(env.vars || []);
  envEditor.style.display = "flex";
}

addEnvBtn.addEventListener("click", () => {
  environments.push({ name: `Environment ${environments.length + 1}`, vars: [] });
  selectedEnvIdx = environments.length - 1;
  persistEnvironments(() => {
    renderEnvSelect();
    envNameInput.focus();
  });
});

deleteEnvBtn.addEventListener("click", () => {
  if (selectedEnvIdx < 0 || !environments.length) return;
  const name = environments[selectedEnvIdx].name;
  showConfirm(`Delete environment "${name}"?`, () => {
    environments.splice(selectedEnvIdx, 1);
    selectedEnvIdx = Math.min(selectedEnvIdx, environments.length - 1);
    persistEnvironments(renderEnvSelect);
  });
});

saveEnvBtn.addEventListener("click", () => {
  saveCurrentEnv();
  renderEnvSelect();
  status.textContent = "Environment saved.";
  setTimeout(() => (status.textContent = ""), 1800);
});

envNameSelect.addEventListener("change", () => {
  selectedEnvIdx = Number(envNameSelect.value);
  renderEnvEditor();
});

document.addEventListener("DOMContentLoaded", () => {
  loadOptions();
  loadEnvironments();
});
saveBtn.addEventListener("click", saveOptions);
resetBtn.addEventListener("click", resetOptions);
clearHistoryBtn.addEventListener("click", clearHistory);
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  applyTheme(themeSelect.value);
});
