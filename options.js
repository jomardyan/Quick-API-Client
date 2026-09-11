const DEFAULT_OPTIONS = window.DEFAULT_OPTIONS;
const clampHistorySize =
  window.clampHistorySize ||
  ((size) => {
    const num = Number(size);
    if (!Number.isFinite(num)) return DEFAULT_OPTIONS.historySize;
    return Math.max(0, Math.min(50, Math.floor(num)));
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
const statusEl = document.getElementById("status");
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
          key: item?.key?.trim?.() || "",
          value: String(item?.value ?? ""),
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
  const timeoutMs = window.clampTimeoutMs(Number(timeoutSeconds.value) * 1000);
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
        statusEl.textContent = "Save failed: " + chrome.runtime.lastError.message;
        return;
      }
      statusEl.textContent = "Saved.";
      applyTheme(newOptions.theme);
      setTimeout(() => (statusEl.textContent = ""), 1800);
    });
  });
}

function resetOptions() {
  chrome.storage.sync.get("options", ({ options }) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = "Reset failed - " + chrome.runtime.lastError.message;
      return;
    }
    // Preferences reset must not delete saved requests.
    const reset = { ...DEFAULT_OPTIONS, favorites: options?.favorites || [] };
    chrome.storage.sync.set({ options: reset }, () => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = "Reset failed - " + chrome.runtime.lastError.message;
        return;
      }
      loadOptions();
      statusEl.textContent = "Reset to defaults.";
      setTimeout(() => (statusEl.textContent = ""), 1800);
    });
  });
}

function clearHistory() {
  chrome.storage.local.set({ history: [] }, () => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = "Error: " + chrome.runtime.lastError.message;
      return;
    }
    statusEl.textContent = "History cleared.";
    setTimeout(() => (statusEl.textContent = ""), 1800);
  });
}

// ── Environment management ────────────────────────────────────────────────────

function loadEnvironments() {
  chrome.storage.sync.get("environments", ({ environments: stored }) => {
    environments = Array.isArray(stored) ? stored : [];
    renderEnvSelect();
  });
}

function saveCurrentEnv(callback) {
  if (selectedEnvIdx < 0 || selectedEnvIdx >= environments.length) return;
  const name = envNameInput.value.trim() || environments[selectedEnvIdx].name;
  if (environments.some((env, idx) => idx !== selectedEnvIdx && env.name === name)) {
    statusEl.textContent = "An environment with this name already exists.";
    return;
  }
  const previousName = environments[selectedEnvIdx].name;
  environments[selectedEnvIdx].name = name;
  environments[selectedEnvIdx].vars = parseKVText(envVarsInput.value);
  persistEnvironments(callback, previousName, name);
}

function persistEnvironments(callback, previousName, nextName) {
  const snapshot = environments.map(env => ({ ...env, vars: env.vars.map(item => ({ ...item })) }));
  [addEnvBtn, deleteEnvBtn, saveEnvBtn].forEach(button => { button.disabled = true; });
  const fail = error => {
    statusEl.textContent = "Env save failed - " + error.message;
    loadEnvironments();
    [addEnvBtn, deleteEnvBtn, saveEnvBtn].forEach(button => { button.disabled = false; });
  };
  chrome.storage.sync.get("options", ({ options }) => {
    if (chrome.runtime.lastError) { fail(chrome.runtime.lastError); return; }
    const update = { environments: snapshot };
    if (previousName && options?.activeEnvironment === previousName) {
      update.options = { ...options, activeEnvironment: nextName || "" };
    }
    chrome.storage.sync.set(update, () => {
      if (chrome.runtime.lastError) { fail(chrome.runtime.lastError); return; }
      [addEnvBtn, deleteEnvBtn, saveEnvBtn].forEach(button => { button.disabled = false; });
      if (callback) callback();
    });
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
  let number = environments.length + 1;
  while (environments.some(env => env.name === `Environment ${number}`)) number++;
  environments.push({ name: `Environment ${number}`, vars: [] });
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
    persistEnvironments(renderEnvSelect, name, "");
  });
});

saveEnvBtn.addEventListener("click", () => {
  saveCurrentEnv(() => {
    renderEnvSelect();
    statusEl.textContent = "Environment saved.";
    setTimeout(() => (statusEl.textContent = ""), 1800);
  });
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
