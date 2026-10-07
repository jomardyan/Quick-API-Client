// Use var to avoid redeclaration errors if script is injected multiple times.
var DEFAULT_OPTIONS = window.DEFAULT_OPTIONS;
var clampHistorySize =
  window.clampHistorySize ||
  ((size) => {
    const num = Number(size);
    if (!Number.isFinite(num)) return DEFAULT_OPTIONS.historySize;
    return Math.max(0, Math.min(50, num));
  });

const methodEl = document.getElementById("method");
const urlEl = document.getElementById("url");
const queryListEl = document.getElementById("queryParams");
const headersListEl = document.getElementById("headers");
const bodyEl = document.getElementById("body");
const sendBtn = document.getElementById("sendBtn");
const sendBtnBottom = document.getElementById("sendBtnBottom");
const copyCurlBtn = document.getElementById("copyCurlBtn");
const themeBtn = document.getElementById("themeBtn");
const applyPresetBtn = document.getElementById("applyPresetBtn");
const presetSelect = document.getElementById("presetSelect");
const historyListEl = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const copyHeadersBtn = document.getElementById("copyHeadersBtn");
const copyBodyBtn = document.getElementById("copyBodyBtn");
const saveBodyBtn = document.getElementById("saveBodyBtn");
const requestPreviewEl = document.getElementById("requestPreview");
const statusBadge = document.getElementById("statusBadge");
const responseMeta = document.getElementById("responseMeta");
const responseHeaders = document.getElementById("responseHeaders");
const responseBody = document.getElementById("responseBody");
const addQueryBtn = document.getElementById("addQueryBtn");
const addHeaderBtn = document.getElementById("addHeaderBtn");
const clearBtn = document.getElementById("clearBtn");
const toastEl = document.getElementById("toast");

// Favorites
const favoriteSelect = document.getElementById("favoriteSelect");
const loadFavoriteBtn = document.getElementById("loadFavoriteBtn");
const saveFavoriteBtn = document.getElementById("saveFavoriteBtn");
const deleteFavoriteBtn = document.getElementById("deleteFavoriteBtn");
const saveFavoriteModal = document.getElementById("saveFavoriteModal");
const favoriteName = document.getElementById("favoriteName");
const confirmSaveFavoriteBtn = document.getElementById("confirmSaveFavoriteBtn");
const cancelSaveFavoriteBtn = document.getElementById("cancelSaveFavoriteBtn");
const closeSaveFavoriteModal = document.getElementById("closeSaveFavoriteModal");

// Auth
const authTemplateBtn = document.getElementById("authTemplateBtn");
const authModal = document.getElementById("authModal");
const authType = document.getElementById("authType");
const applyAuthBtn = document.getElementById("applyAuthBtn");
const cancelAuthBtn = document.getElementById("cancelAuthBtn");
const closeAuthModal = document.getElementById("closeAuthModal");
const bearerToken = document.getElementById("bearerToken");
const basicUsername = document.getElementById("basicUsername");
const basicPassword = document.getElementById("basicPassword");
const apiKeyName = document.getElementById("apiKeyName");
const apiKeyValue = document.getElementById("apiKeyValue");
const bearerFields = document.getElementById("bearerFields");
const basicFields = document.getElementById("basicFields");
const apikeyFields = document.getElementById("apikeyFields");

// Help
const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const closeHelpModal = document.getElementById("closeHelpModal");
const closeHelpModalBtn = document.getElementById("closeHelpModalBtn");

// Cancel in-flight request
const cancelBtn = document.getElementById("cancelBtn");

// Confirmation modal
const confirmModal = document.getElementById("confirmModal");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmModalOkBtn = document.getElementById("confirmModalOkBtn");
const confirmModalCancelBtn = document.getElementById("confirmModalCancelBtn");

// Environment selector
const envSelect = document.getElementById("envSelect");
const envVarCount = document.getElementById("envVarCount");

// GraphQL mode
const gqlToggleBtn = document.getElementById("gqlToggleBtn");
const gqlVarsRow = document.getElementById("gqlVarsRow");
const gqlVariables = document.getElementById("gqlVariables");
const requestError = document.getElementById("requestError");
const responsePanel = document.querySelector(".response");
const responseEmpty = document.getElementById("responseEmpty");
const validateBtn = document.getElementById("validateBtn");

document.body.dataset.view = new URLSearchParams(window.location.search).get("tab") === "1" ? "tab" : "popup";
document.documentElement.dataset.view = document.body.dataset.view;

const isBodyless = (method) => ["GET", "HEAD"].includes(method);
let maxHistory = 8;
let favorites = [];
let favoriteMutationPending = false;

// ── Debounce utility ──────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
// Debounced versions used by keystroke handlers to avoid excessive storage I/O
const debouncedSaveState = debounce(() => saveState(), 300);
const debouncedUpdatePreview = debounce(() => updatePreview(), 150);

// ── In-flight request state ───────────────────────────────────────────────────
let isRequestInFlight = false;
let activeRequestId = null;
let swGuardTimeoutId = null;

// ── GraphQL mode ──────────────────────────────────────────────────────────────
let gqlMode = false;

function disableGqlMode() {
  gqlMode = false;
  methodEl.disabled = false;
  gqlToggleBtn.classList.remove("primary");
  gqlToggleBtn.classList.add("ghost");
  gqlToggleBtn.setAttribute("aria-pressed", "false");
  gqlVarsRow.style.display = "none";
  gqlVariables.value = "";
}

function setGqlMode(enabled) {
  gqlMode = enabled;
  methodEl.disabled = enabled;
  if (!enabled) gqlVariables.value = "";
  gqlToggleBtn.classList.toggle("primary", enabled);
  gqlToggleBtn.classList.toggle("ghost", !enabled);
  gqlToggleBtn.setAttribute("aria-pressed", String(enabled));
  gqlVarsRow.style.display = enabled ? "" : "none";
  if (enabled) {
    // Force POST and set Content-Type when activating GraphQL
    methodEl.value = "POST";
    // Ensure Content-Type: application/json header exists
    const existing = readKV(headersListEl);
    const hasCT = existing.some(({ key }) => key.toLowerCase() === "content-type");
    if (!hasCT) createKVRow(headersListEl, "Content-Type", "application/json");
  }
  updatePreview();
  saveState();
}

// ── Environment variable substitution ────────────────────────────────────────

function getActiveEnvVars() {
  const envName = currentOptions.activeEnvironment || "";
  if (!envName || !currentEnvironments.length) return [];
  const env = currentEnvironments.find((e) => e.name === envName);
  return env ? (env.vars || []) : [];
}

function renderEnvSelect() {
  envSelect.innerHTML = '<option value="">No environment</option>';
  currentEnvironments.forEach((env) => {
    const opt = document.createElement("option");
    opt.value = env.name;
    opt.textContent = env.name;
    envSelect.appendChild(opt);
  });
  // Restore prior selection or active env from options
  const desired = currentOptions.activeEnvironment || "";
  envSelect.value = currentEnvironments.some(env => env.name === desired) ? desired : "";
  updateEnvVarCount();
}

function updateEnvVarCount() {
  const vars = getActiveEnvVars();
  envVarCount.textContent = vars.length ? `${vars.length} var${vars.length !== 1 ? "s" : ""} active` : "";
}

const PRESETS = {
  jsonplaceholder: {
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    headers: [{ key: "Accept", value: "application/json" }],
    query: [],
    body: "",
  },
  github: {
    method: "GET",
    url: "https://api.github.com/repos/octocat/Hello-World",
    headers: [
      { key: "Accept", value: "application/vnd.github+json" },
      { key: "User-Agent", value: "Quick-API-Client" },
    ],
    query: [],
    body: "",
  },
  "httpbin-get": {
    method: "GET",
    url: "https://httpbin.org/get",
    headers: [{ key: "Accept", value: "application/json" }],
    query: [{ key: "source", value: "quick-api-client" }],
    body: "",
  },
  "httpbin-post": {
    method: "POST",
    url: "https://httpbin.org/post",
    headers: [
      { key: "Accept", value: "application/json" },
      { key: "Content-Type", value: "application/json" },
    ],
    query: [],
    body: JSON.stringify({ hello: "world" }, null, 2),
  },
};

let currentOptions = { ...DEFAULT_OPTIONS };
let historyItems = [];
let currentEnvironments = [];

function createKVRow(container, key = "", value = "") {
  const row = document.createElement("div");
  row.className = "kv-row";

  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.className = "kv-key";
  keyInput.placeholder = "Key";
  keyInput.value = key;
  const kind = container === headersListEl ? "Header" : "Query parameter";
  keyInput.setAttribute("aria-label", `${kind} name`);
  keyInput.spellcheck = false;
  keyInput.autocomplete = "off";

  const valInput = document.createElement("input");
  valInput.type = "text";
  valInput.className = "kv-value";
  valInput.placeholder = "Value";
  valInput.value = value;
  valInput.setAttribute("aria-label", `${kind} value`);
  valInput.spellcheck = false;
  valInput.autocomplete = "off";

  const removeBtn = document.createElement("button");
  removeBtn.className = "ghost small remove";
  removeBtn.title = "Remove";
  removeBtn.textContent = "✕";
  removeBtn.setAttribute("aria-label", `Remove ${kind.toLowerCase()}`);

  [keyInput, valInput].forEach((input) =>
    ["input", "change"].forEach((evt) =>
      input.addEventListener(evt, () => {
        debouncedUpdatePreview();
        debouncedSaveState();
      })
    )
  );

  removeBtn.addEventListener("click", () => {
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    (next?.querySelector("input") || (container === headersListEl ? addHeaderBtn : addQueryBtn)).focus();
    updatePreview();
    saveState();
  });

  row.append(keyInput, valInput, removeBtn);
  container.appendChild(row);
  return row;
}

function readKV(container) {
  return Array.from(container.querySelectorAll(".kv-row"))
    .map((row) => {
      const key = row.querySelector(".kv-key").value.trim();
      const value = row.querySelector(".kv-value").value;
      return key ? { key, value } : null;
    })
    .filter(Boolean);
}

function prettifyJsonMaybe(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (err) {
    return text;
  }
}

function highlightJson(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          const isKey = /:$/.test(match);
          return `<span class="${isKey ? "tok-key" : "tok-str"}">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="tok-bool">${match}</span>`;
        if (/null/.test(match)) return `<span class="tok-null">${match}</span>`;
        return `<span class="tok-num">${match}</span>`;
      }
    );
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tokSpan(cls, text) {
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

// Runs `regex` over `text`, wrapping matches via `classify(match)` and escaping everything else.
function tokenize(text, regex, classify) {
  let out = "";
  let last = 0;
  text.replace(regex, (match, ...rest) => {
    const offset = rest[rest.length - 2];
    out += escapeHtml(text.slice(last, offset));
    out += classify(match);
    last = offset + match.length;
    return match;
  });
  return out + escapeHtml(text.slice(last));
}

function highlightMarkup(text) {
  const tagRe = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[!?][^>]*>|<\/?[A-Za-z][^\s>/]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
  return tokenize(text, tagRe, (m) => {
    if (m.startsWith("<!--")) return tokSpan("tok-comment", m);
    if (/^<[!?]/.test(m)) return tokSpan("tok-meta", m);
    const parts = /^(<\/?)([^\s>/]+)([\s\S]*?)(\/?>)$/.exec(m);
    if (!parts) return escapeHtml(m);
    const attrs = tokenize(parts[3], /([^\s=]+)(?:(=)("[^"]*"|'[^']*'|[^\s"']+))?/g, (a) => {
      const am = /^([^\s=]+)(?:(=)([\s\S]*))?$/.exec(a);
      return am[2]
        ? tokSpan("tok-attr", am[1]) + escapeHtml("=") + tokSpan("tok-str", am[3])
        : tokSpan("tok-attr", am[1]);
    });
    return escapeHtml(parts[1]) + tokSpan("tok-tag", parts[2]) + attrs + escapeHtml(parts[4]);
  });
}

function highlightCss(text) {
  const re = /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@[\w-]+|#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b|[\w-]+(?=\s*:(?!:))/g;
  return tokenize(text, re, (m) => {
    if (m.startsWith("/*")) return tokSpan("tok-comment", m);
    if (/^["']/.test(m)) return tokSpan("tok-str", m);
    if (m[0] === "@") return tokSpan("tok-keyword", m);
    if (m[0] === "#" || /^-?\d/.test(m) || /^-?\./.test(m)) return tokSpan("tok-num", m);
    return tokSpan("tok-key", m);
  });
}

const JS_KEYWORDS = "var|let|const|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|delete|void|yield";

function highlightJs(text) {
  const re = new RegExp(
    `\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\[\\s\\S]|[^\`\\\\])*\`|\\b(?:true|false|null|undefined)\\b|\\b(?:${JS_KEYWORDS})\\b|\\b\\d+(?:\\.\\d+)?\\b`,
    "g"
  );
  return tokenize(text, re, (m) => {
    if (m.startsWith("/*") || m.startsWith("//")) return tokSpan("tok-comment", m);
    if (/^["'`]/.test(m)) return tokSpan("tok-str", m);
    if (/^(true|false)$/.test(m)) return tokSpan("tok-bool", m);
    if (/^(null|undefined)$/.test(m)) return tokSpan("tok-null", m);
    if (/^\d/.test(m)) return tokSpan("tok-num", m);
    return tokSpan("tok-keyword", m);
  });
}

// Picks a body language from the Content-Type header, falling back to sniffing the body.
function detectBodyLang(contentType, body) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("json")) return "json";
  if (ct.includes("html")) return "html";
  if (ct.includes("xml")) return "xml";
  if (ct.includes("css")) return "css";
  if (ct.includes("javascript") || ct.includes("ecmascript")) return "js";
  const head = body.trimStart();
  if (/^(?:<!doctype\s+html|<html[\s>])/i.test(head)) return "html";
  if (/^<\?xml/i.test(head)) return "xml";
  if (head.startsWith("{") || head.startsWith("[")) {
    try {
      JSON.parse(body);
      return "json";
    } catch (err) {
      return "text";
    }
  }
  if (head.startsWith("<")) return "xml";
  try {
    JSON.parse(body);
    return "json";
  } catch (err) {
    return "text";
  }
}

function renderBody(contentType, body) {
  if (body.length > 200000) return { lang: "text", html: null, text: body };
  const lang = detectBodyLang(contentType, body);
  switch (lang) {
    case "json": return { lang, html: highlightJson(prettifyJsonMaybe(body)) };
    case "html":
    case "xml": return { lang, html: highlightMarkup(body) };
    case "css": return { lang, html: highlightCss(body) };
    case "js": return { lang, html: highlightJs(body) };
    default: return { lang: "text", html: null, text: body };
  }
}

function highlightHeaders(lines) {
  return lines
    .map((line, idx) => {
      const safe = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (idx === 0 && safe.startsWith("HTTP")) {
        return `<span class="tok-status">${safe}</span>`;
      }
      const [key, ...rest] = safe.split(":");
      if (!rest.length) return safe;
      const value = rest.join(":").trim();
      return `<span class="tok-header-key">${key}:</span> <span class="tok-header-val">${value}</span>`;
    })
    .join("\n");
}

function snapshotRequest() {
  return {
    method: methodEl.value,
    url: urlEl.value,
    query: readKV(queryListEl),
    headers: readKV(headersListEl),
    body: bodyEl.value,
    gqlMode,
    gqlVariables: gqlVariables.value,
  };
}

function saveState() {
  chrome.storage.local.set({ lastRequest: snapshotRequest() }, () => {
    if (chrome.runtime.lastError) showToast("Could not save request - " + chrome.runtime.lastError.message);
  });
}

function applyTheme(themeChoice) {
  const resolved = themeChoice === "dark" ? "dark" : "light";
  currentOptions.theme = resolved;
  document.body.dataset.theme = resolved;
  themeBtn.textContent = `Theme: ${resolved === "dark" ? "Dark" : "Light"}`;
  themeBtn.title = `Switch to ${resolved === "dark" ? "light" : "dark"} theme (T)`;
}

function loadOptions() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["options", "environments"], ({ options, environments }) => {
      currentOptions = { ...DEFAULT_OPTIONS, ...(options || {}) };
      maxHistory = clampHistorySize(currentOptions.historySize ?? DEFAULT_OPTIONS.historySize);
      favorites = Array.isArray(currentOptions.favorites) ? currentOptions.favorites : [];
      currentEnvironments = Array.isArray(environments) ? environments : [];
      applyTheme(currentOptions.theme);
      renderFavorites();
      renderEnvSelect();
      chrome.storage.local.get("history", ({ history }) => {
        historyItems = Array.isArray(history) ? history : [];
        renderHistory();
        resolve(currentOptions);
      });
    });
  });
}

function restoreState() {
  chrome.storage.local.get("lastRequest", ({ lastRequest }) => {
    const useLast = (currentOptions.restoreLast || document.body.dataset.view === "tab") && lastRequest;
    const base = useLast
      ? lastRequest
      : {
          method: "GET",
          url: currentOptions.defaultUrl,
          query: currentOptions.defaultQuery,
          headers: currentOptions.defaultHeaders,
          body: currentOptions.defaultBody,
        };

    methodEl.value = base.method || "GET";
    urlEl.value = base.url || "";

    queryListEl.innerHTML = "";
    headersListEl.innerHTML = "";

    const query = base.query && base.query.length ? base.query : [{}];
    const headers = base.headers && base.headers.length ? base.headers : [{}];

    query.forEach(({ key = "", value = "" }) => createKVRow(queryListEl, key, value));
    headers.forEach(({ key = "", value = "" }) => createKVRow(headersListEl, key, value));

    bodyEl.value = base.body || "";
    if (base.gqlMode) {
      gqlVariables.value = base.gqlVariables || "";
      setGqlMode(true);
    }
    updatePreview();
  });
}

function updatePreview() {
  try {
    const request = prepareRequest();
    requestPreviewEl.textContent = [
      `${request.method} ${request.url} HTTP/1.1`,
      request.headers.map(({ key, value }) => `${key}: ${value}`).join("\n"),
      request.body,
    ].filter(Boolean).join("\n\n");
    requestError.hidden = true;
    requestError.textContent = "";
  } catch (err) {
    requestPreviewEl.textContent = err.message;
    requestError.hidden = false;
    requestError.textContent = err.message;
  }
  document.getElementById("bodyHint").textContent = gqlMode
    ? "GraphQL query string" : isBodyless(methodEl.value) ? "Ignored for GET/HEAD" : "Sends the body exactly as entered";
}

function prepareRequest() {
  return window.QuickRequest.prepare(snapshotRequest(), getActiveEnvVars());
}

function originFromUrl(url) {
  try {
    return new URL(url).origin + "/*";
  } catch {
    return null;
  }
}

function ensureOriginPermission(origin) {
  return new Promise((resolve) => {
    if (!origin) return resolve(false);
    // Request directly from the click gesture. Already granted access resolves without another prompt.
    chrome.permissions.request({ origins: [origin] }, (granted) => {
      const error = chrome.runtime.lastError;
      if (error) showToast(error.message);
      resolve(!error && Boolean(granted));
    });
  });
}

function renderFavorites() {
  const selected = favoriteSelect.value;
  favoriteSelect.innerHTML = "";
  if (!favorites || favorites.length === 0) {
    favoriteSelect.innerHTML = '<option value="">No favorites saved yet</option>';
    updateFavoriteActions();
    return;
  }
  favoriteSelect.innerHTML = '<option value="">Select a favorite…</option>';
  favorites.forEach((fav, idx) => {
    const option = document.createElement("option");
    option.value = idx;
    option.textContent = fav.name;
    favoriteSelect.appendChild(option);
  });
  favoriteSelect.value = favorites[selected] ? selected : "";
  updateFavoriteActions();
}

function updateFavoriteActions() {
  const selected = favoriteSelect.value !== "" && Boolean(favorites[Number(favoriteSelect.value)]);
  loadFavoriteBtn.disabled = deleteFavoriteBtn.disabled = !selected || favoriteMutationPending;
  confirmSaveFavoriteBtn.disabled = favoriteMutationPending;
}

function saveFavorite(name) {
  if (favoriteMutationPending) return;
  const method = methodEl.value;
  const query = readKV(queryListEl);
  const headers = readKV(headersListEl);
  const url = urlEl.value;
  const body = bodyEl.value;

  // Warn if any header looks like a credential (stored plaintext in sync storage)
  const sensitivePatterns = ["authorization", "x-api-key", "api-key", "x-auth-token", "x-access-token"];
  const hasCredential = headers.some(({ key }) => sensitivePatterns.includes(key.toLowerCase()));

  const favorite = { name, method, url, query, headers, body, gqlMode, gqlVariables: gqlVariables.value };
  favoriteMutationPending = true;
  updateFavoriteActions();
  chrome.storage.sync.get("options", ({ options }) => {
    if (chrome.runtime.lastError) {
      favoriteMutationPending = false;
      updateFavoriteActions();
      showToast("Save failed - " + chrome.runtime.lastError.message);
      return;
    }
    const nextFavorites = [...(Array.isArray(options?.favorites) ? options.favorites : []), favorite];
    const newOptions = { ...DEFAULT_OPTIONS, ...(options || {}), favorites: nextFavorites };
    chrome.storage.sync.set({ options: newOptions }, () => {
      if (chrome.runtime.lastError) {
        favoriteMutationPending = false;
        updateFavoriteActions();
        showToast("Save failed - " + chrome.runtime.lastError.message);
        return;
      }
      favoriteMutationPending = false;
      favorites = nextFavorites;
      renderFavorites();
      favoriteSelect.value = String(favorites.length - 1);
      updateFavoriteActions();
      closeSaveFavoriteModalFn();
      showToast(hasCredential ? "Saved ⚠ contains credentials" : "Favorite saved");
    });
  });
}

function applyFavorite() {
  const idx = favoriteSelect.value;
  if (!idx || !favorites[idx]) return;
  
  const fav = favorites[idx];
  methodEl.value = fav.method;
  urlEl.value = fav.url;
  queryListEl.innerHTML = "";
  headersListEl.innerHTML = "";
  (fav.query?.length ? fav.query : [{}]).forEach(({ key = "", value = "" }) =>
    createKVRow(queryListEl, key, value)
  );
  (fav.headers?.length ? fav.headers : [{}]).forEach(({ key = "", value = "" }) =>
    createKVRow(headersListEl, key, value)
  );
  bodyEl.value = fav.body || "";
  if (fav.gqlMode) {
    gqlVariables.value = fav.gqlVariables || "";
    setGqlMode(true);
  } else {
    disableGqlMode();
  }
  updatePreview();
  saveState();
}

function deleteFavorite() {
  if (favoriteMutationPending) return;
  const idx = favoriteSelect.value;
  if (!idx || !favorites[Number(idx)]) {
    showToast("Select a favorite to delete");
    return;
  }

  showConfirm(`Delete "${favorites[Number(idx)].name}"?`, () => {
    if (favoriteMutationPending) return;
    favoriteMutationPending = true;
    updateFavoriteActions();
    const nextFavorites = favorites.filter((_, index) => index !== Number(idx));
    chrome.storage.sync.get("options", ({ options }) => {
      if (chrome.runtime.lastError) {
        favoriteMutationPending = false;
        updateFavoriteActions();
        showToast("Delete failed - " + chrome.runtime.lastError.message);
        return;
      }
      const newOptions = { ...DEFAULT_OPTIONS, ...(options || {}), favorites: nextFavorites };
      chrome.storage.sync.set({ options: newOptions }, () => {
        if (chrome.runtime.lastError) {
          favoriteMutationPending = false;
          updateFavoriteActions();
          showToast("Delete failed: " + chrome.runtime.lastError.message);
          return;
        }
        favoriteMutationPending = false;
        favorites = nextFavorites;
        renderFavorites();
        showToast("Favorite deleted");
      });
    });
  });
}

function openAuthModal() {
  window.QuickUI.openModal(authModal, authType);
}

function closeAuthModalFn() {
  window.QuickUI.closeModal(authModal);
  // Clear inputs
  bearerToken.value = "";
  basicUsername.value = "";
  basicPassword.value = "";
  apiKeyName.value = "";
  apiKeyValue.value = "";
}

function openSaveFavoriteModal() {
  window.QuickUI.openModal(saveFavoriteModal, favoriteName);
}

function closeSaveFavoriteModalFn() {
  window.QuickUI.closeModal(saveFavoriteModal);
  favoriteName.value = "";
}

function openHelpModal() {
  window.QuickUI.openModal(helpModal, closeHelpModalBtn);
}

function closeHelpModalFn() {
  window.QuickUI.closeModal(helpModal);
}

function upsertAuth(container, key, value) {
  const rows = Array.from(container.querySelectorAll(".kv-row"));
  rows.filter(row => {
    const existing = row.querySelector(".kv-key").value.trim();
    return container === queryListEl ? existing === key : existing.toLowerCase() === key.toLowerCase();
  }).forEach(row => row.remove());
  createKVRow(container, key, value);
}

function applyAuthTemplate() {
  const type = authType.value;
  
  if (type === "bearer") {
    const token = bearerToken.value.trim();
    if (!token) {
      showToast("Enter a token");
      return;
    }
    upsertAuth(headersListEl, "Authorization", `Bearer ${token}`);
    showToast("Bearer auth added");
  } else if (type === "basic") {
    const username = basicUsername.value;
    const password = basicPassword.value;
    if (!username) {
      showToast("Enter username and password");
      return;
    }
    // Basic validation for problematic characters in credentials
    if (username.includes(':')) {
      showToast("Username cannot contain colon (:)");
      return;
    }
    try {
      // Use encodeURIComponent/unescape to safely handle non-ASCII characters
      // before passing to btoa, per RFC 7617 UTF-8 encoding for Basic auth.
      const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
      upsertAuth(headersListEl, "Authorization", `Basic ${encoded}`);
      showToast("Basic auth added");
    } catch (err) {
      showToast("Invalid characters in credentials");
      return;
    }
  } else if (type === "apikey-header") {
    const keyName = apiKeyName.value.trim();
    const keyValue = apiKeyValue.value.trim();
    if (!keyName || !keyValue) {
      showToast("Enter key name and value");
      return;
    }
    upsertAuth(headersListEl, keyName, keyValue);
    showToast("API key added");
  } else if (type === "apikey-query") {
    const keyName = apiKeyName.value.trim();
    const keyValue = apiKeyValue.value.trim();
    if (!keyName || !keyValue) {
      showToast("Enter key name and value");
      return;
    }
    upsertAuth(queryListEl, keyName, keyValue);
    showToast("API key added");
  }
  
  closeAuthModalFn();
  updatePreview();
  saveState();
}

function renderHistory() {
  historyListEl.innerHTML = "";
  clearHistoryBtn.disabled = !historyItems.length;
  if (currentOptions.historyEnabled === false || maxHistory === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "History disabled in options.";
    historyListEl.appendChild(hint);
    return;
  }
  if (!historyItems.length) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "No recent requests yet.";
    historyListEl.appendChild(hint);
    return;
  }
  historyItems.slice(0, maxHistory).forEach((item) => {
    const el = document.createElement("div");
    el.className = "history-item";

    const titleEl = document.createElement("div");
    titleEl.className = "title";
    titleEl.textContent = `${item.method} ${item.url}`;

    const metaEl = document.createElement("div");
    metaEl.className = "meta";
    metaEl.textContent = item.timestamp || "";

    el.appendChild(titleEl);
    el.appendChild(metaEl);

    function loadHistoryItem() {
      methodEl.value = item.method;
      urlEl.value = item.url;
      queryListEl.innerHTML = "";
      headersListEl.innerHTML = "";
      (item.query?.length ? item.query : [{}]).forEach(({ key = "", value = "" }) =>
        createKVRow(queryListEl, key, value)
      );
      (item.headers?.length ? item.headers : [{}]).forEach(({ key = "", value = "" }) =>
        createKVRow(headersListEl, key, value)
      );
      bodyEl.value = item.body || "";
      if (item.gqlMode) {
        gqlVariables.value = item.gqlVariables || "";
        setGqlMode(true);
      } else {
        setGqlMode(false);
      }
      updatePreview();
      saveState();
    }
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("click", loadHistoryItem);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        loadHistoryItem();
      }
    });
    historyListEl.appendChild(el);
  });
}

// ── Request lifecycle helpers ─────────────────────────────────────────────────

function clearSendingState() {
  isRequestInFlight = false;
  activeRequestId = null;
  clearTimeout(swGuardTimeoutId);
  swGuardTimeoutId = null;
  sendBtn.disabled = false;
  sendBtnBottom.disabled = false;
  sendBtn.classList.remove("loading");
  sendBtnBottom.classList.remove("loading");
  cancelBtn.style.display = "none";
  responsePanel.setAttribute("aria-busy", "false");
}

function resetResponse(message = "Send a request to see its status, headers, and response body here.") {
  responseMeta.textContent = "";
  responseHeaders.textContent = "";
  responseBody.textContent = "";
  delete responseBody.dataset.raw;
  delete responseBody.dataset.bytes;
  delete responseBody.dataset.lang;
  delete responseBody.dataset.contentType;
  responsePanel.dataset.received = "false";
  responseEmpty.textContent = message;
  responseEmpty.hidden = false;
  copyHeadersBtn.disabled = copyBodyBtn.disabled = saveBodyBtn.disabled = validateBtn.disabled = true;
}

function revealResponse() {
  if (window.matchMedia("(max-width: 899px)").matches) {
    responsePanel.scrollIntoView?.({ block: "start" });
  }
}

function abortBackgroundRequest(requestId) {
  if (!requestId) return;
  chrome.runtime.sendMessage({ type: "cancel-request", payload: { requestId } }, () => {
    void chrome.runtime.lastError;
  });
}

function cancelCurrentRequest() {
  if (!isRequestInFlight) return;
  abortBackgroundRequest(activeRequestId);
  clearSendingState();
  statusBadge.textContent = "Cancelled";
  statusBadge.className = "badge warn";
  responseMeta.textContent = "Request cancelled by user.";
  responseEmpty.hidden = true;
  showToast("Request cancelled");
}

async function sendRequest() {
  if (isRequestInFlight) return; // prevent concurrent sends
  const requestId = crypto.randomUUID();
  activeRequestId = requestId;
  isRequestInFlight = true;
  sendBtn.disabled = sendBtnBottom.disabled = true;
  cancelBtn.style.display = "";
  resetResponse("Preparing your request…");
  statusBadge.textContent = "Preparing…";
  statusBadge.className = "badge muted";
  responsePanel.setAttribute("aria-busy", "true");
  try {
    updatePreview();
    const snapshot = snapshotRequest();
    const { method, url: finalUrl, headers, body } = prepareRequest();
    const headersObj = Object.fromEntries(headers.map(({ key, value }) => [key, value]));
    const allowed = await ensureOriginPermission(originFromUrl(finalUrl));
    if (activeRequestId !== requestId) return;
    if (!allowed) {
      clearSendingState();
      statusBadge.textContent = "Permission denied";
      statusBadge.className = "badge err";
      responseMeta.textContent = "Allow host permission to send this request.";
      responseEmpty.hidden = true;
      revealResponse();
      return;
    }

    // Show loading state and mark in-flight
    isRequestInFlight = true;
    activeRequestId = requestId;
    sendBtn.disabled = true;
    sendBtnBottom.disabled = true;
    sendBtn.classList.add("loading");
    sendBtnBottom.classList.add("loading");
    cancelBtn.style.display = "";

    statusBadge.textContent = "Sending...";
    statusBadge.className = "badge muted";
    responseEmpty.textContent = "Waiting for the server…";

    // Guard: if the service worker is killed mid-request, the callback never fires.
    // After timeout + 5 s we recover the UI instead of hanging forever.
    const effectiveTimeout = window.clampTimeoutMs(currentOptions.timeoutMs);
    swGuardTimeoutId = setTimeout(() => {
      if (activeRequestId !== requestId) return;
      abortBackgroundRequest(requestId);
      clearSendingState();
      statusBadge.textContent = "SW Error";
      statusBadge.className = "badge err";
      responseMeta.textContent = "Background was restarted mid-request. Please try again.";
      responseEmpty.hidden = true;
      revealResponse();
      showToast("Try again — extension restarted");
    }, effectiveTimeout + 5000);

    chrome.runtime.sendMessage(
      {
        type: "api-request",
        payload: {
          url: finalUrl,
          method,
          headers: headersObj,
          body,
          timeoutMs: effectiveTimeout,
          requestId: activeRequestId,
        },
      },
      (res) => {
        const runtimeError = chrome.runtime.lastError;
        if (activeRequestId !== requestId) return;
        clearSendingState();
        responseEmpty.hidden = true;
        revealResponse();
        if (runtimeError) {
          statusBadge.textContent = "Error";
          statusBadge.className = "badge err";
          responseMeta.textContent = "Connection error";
          responseBody.textContent = runtimeError.message;
          showToast("Connection error");
          return;
        }
        if (!res) {
          statusBadge.textContent = "Error";
          statusBadge.className = "badge err";
          responseMeta.textContent = "No response from background. Reload extension.";
          responseBody.textContent = "Try reloading the extension in chrome://extensions/";
          showToast("Extension error");
          return;
        }
        if (!res.ok) {
          statusBadge.textContent = "Error";
          statusBadge.className = "badge err";
          responseMeta.textContent = res.error || "Request failed";
          responseBody.textContent =
            res.error ||
            "Check the URL and try again. If using a non-standard API, it may have CORS restrictions.";
          showToast("Request failed");
          return;
        }

        responseBody.dataset.raw = res.body || "";
        responseBody.dataset.bytes = String(res.bodyBytes ?? new Blob([res.body || ""]).size);
        responseBody.dataset.contentType = (res.headers || []).find(([key]) => key.toLowerCase() === "content-type")?.[1] || "text/plain";
        responsePanel.dataset.received = "true";
        copyHeadersBtn.disabled = copyBodyBtn.disabled = saveBodyBtn.disabled = false;
        validateBtn.disabled = !(res.body || "").length;
        const statusClass =
          res.status >= 200 && res.status < 300
            ? "ok"
            : res.status >= 400
            ? "err"
            : "warn";
        statusBadge.textContent = `${res.status} ${res.statusText}`;
        statusBadge.className = `badge ${statusClass}`;
        responseMeta.textContent = `${res.elapsed}ms • ${res.type.toUpperCase()} • ${res.url}`;
        const headerLines = (res.headers || []).map(([k, v]) => `${k}: ${v}`);
        const headerBlock = [`HTTP ${res.status} ${res.statusText}`, ...headerLines];
        responseHeaders.innerHTML = highlightHeaders(headerBlock);
        const rendered = renderBody(responseBody.dataset.contentType, res.body || "");
        if (rendered.html !== null) {
          responseBody.innerHTML = rendered.html;
        } else {
          responseBody.textContent = rendered.text;
        }
        responseBody.dataset.lang = rendered.lang;
        
        showToast(statusClass === "ok" ? "Success" : "Request completed");

        if (currentOptions.historyEnabled !== false && maxHistory > 0) {
          const now = new Date();
          const timestamp = `${now.toLocaleDateString()} ${now
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            .toString()}`;
          const entry = { ...snapshot, timestamp };
          historyItems = [entry, ...historyItems].slice(0, maxHistory);
          chrome.storage.local.set({ history: historyItems }, () => {
            if (chrome.runtime.lastError) showToast("Response received but history could not be saved");
          });
          renderHistory();
        }
      }
    );

    saveState();
  } catch (err) {
    if (activeRequestId !== requestId) return;
    clearSendingState();
    statusBadge.textContent = "Client Error";
    statusBadge.className = "badge err";
    responseEmpty.hidden = true;
    responseMeta.textContent = "Check your request and try again.";
    responseBody.textContent = err.message;
    revealResponse();
    showToast("Error occurred");
  }
}

function shellEscape(str) {
  return `'${str.replace(/'/g, `'"'"'`)}'`;
}

function buildCurl() {
  const { method, url, headers, body } = prepareRequest();
  const lines = [`curl -X ${method} ${shellEscape(url)}`];
  headers.forEach(({ key, value }) => lines.push(`  -H ${shellEscape(`${key}: ${value}`)}`));
  if (body) lines.push(`  --data-raw ${shellEscape(body)}`);
  return lines.join(" \\\n");
}

async function copyCurl() {
  try {
    const text = buildCurl();
    await navigator.clipboard.writeText(text);
    showToast("cURL copied");
  } catch (err) {
    showToast(err.message || "Clipboard blocked");
  }
}

function resetForm() {
  cancelCurrentRequest();
  methodEl.value = "GET";
  urlEl.value = currentOptions.defaultUrl || "";
  queryListEl.innerHTML = "";
  headersListEl.innerHTML = "";
  bodyEl.value = currentOptions.defaultBody || "";
  disableGqlMode();

  (currentOptions.defaultQuery?.length ? currentOptions.defaultQuery : [{}]).forEach(
    ({ key = "", value = "" }) => createKVRow(queryListEl, key, value)
  );
  (currentOptions.defaultHeaders?.length ? currentOptions.defaultHeaders : [{}]).forEach(
    ({ key = "", value = "" }) => createKVRow(headersListEl, key, value)
  );

  statusBadge.textContent = "Ready";
  statusBadge.className = "badge muted";
  resetResponse();

  updatePreview();
  saveState();
}

function cycleTheme() {
  const next = currentOptions.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  chrome.storage.sync.get("options", ({ options }) => {
    const newOptions = { ...DEFAULT_OPTIONS, ...(options || {}), theme: next };
    chrome.storage.sync.set({ options: newOptions }, () => {
      if (chrome.runtime.lastError) showToast("Theme changed, but could not be saved");
    });
  });
}

function applyPreset() {
  const key = presetSelect.value;
  if (!key || !PRESETS[key]) return;
  const preset = PRESETS[key];
  methodEl.value = preset.method;
  urlEl.value = preset.url;
  queryListEl.innerHTML = "";
  headersListEl.innerHTML = "";
  (preset.query?.length ? preset.query : [{}]).forEach(({ key = "", value = "" }) =>
    createKVRow(queryListEl, key, value)
  );
  (preset.headers?.length ? preset.headers : [{}]).forEach(({ key = "", value = "" }) =>
    createKVRow(headersListEl, key, value)
  );
  bodyEl.value = preset.body || "";
  disableGqlMode();
  updatePreview();
  saveState();
}

function clearHistory() {
  chrome.storage.local.set({ history: [] }, () => {
    if (chrome.runtime.lastError) { showToast("Could not clear history"); return; }
    historyItems = [];
    renderHistory();
    showToast("History cleared");
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied");
  } catch (err) {
    showToast("Clipboard blocked");
  }
}

function downloadBody() {
  const type = responseBody.dataset.contentType || "text/plain";
  const mime = type.split(";")[0].trim().toLowerCase();
  const extension = /(?:\/|\+)json$/.test(mime) ? "json" : /(?:\/|\+)xml$/.test(mime) ? "xml" : ({ "text/html": "html", "text/css": "css", "text/csv": "csv" }[mime] || "txt");
  const blob = new Blob([responseBody.dataset.raw ?? responseBody.textContent ?? ""], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `response.${extension}`;
  a.click();
  // Defer revocation to allow the browser to initiate the download first
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

let _confirmCallback = null;

function showConfirm(message, onOk) {
  confirmModalMessage.textContent = message;
  _confirmCallback = onOk;
  window.QuickUI.openModal(confirmModal, confirmModalCancelBtn);
}

function closeConfirmModal() {
  window.QuickUI.closeModal(confirmModal);
  _confirmCallback = null;
}

let toastTimeout;
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1600);
}

function openRequestTab(event) {
  event?.preventDefault();
  chrome.storage.local.set({ lastRequest: snapshotRequest() }, () => {
    if (chrome.runtime.lastError) { showToast("Could not open request - " + chrome.runtime.lastError.message); return; }
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?tab=1") });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadOptions();
  restoreState();
  updatePreview();
});

["input", "change"].forEach((evt) => {
  [methodEl, urlEl, bodyEl].forEach((el) =>
    el.addEventListener(evt, () => {
      debouncedUpdatePreview();
      debouncedSaveState();
    })
  );
});

addQueryBtn.addEventListener("click", () => {
  createKVRow(queryListEl).querySelector("input").focus();
});

addHeaderBtn.addEventListener("click", () => {
  createKVRow(headersListEl).querySelector("input").focus();
});

sendBtn.addEventListener("click", sendRequest);
sendBtnBottom.addEventListener("click", sendRequest);
copyCurlBtn.addEventListener("click", copyCurl);
clearBtn.addEventListener("click", resetForm);
document.getElementById("openTabLink").addEventListener("click", openRequestTab);
themeBtn.addEventListener("click", cycleTheme);
applyPresetBtn.addEventListener("click", applyPreset);
clearHistoryBtn.addEventListener("click", clearHistory);
copyHeadersBtn.addEventListener("click", () => copyText(responseHeaders.textContent));
copyBodyBtn.addEventListener("click", () => copyText(responseBody.dataset.raw ?? responseBody.textContent));
saveBodyBtn.addEventListener("click", downloadBody);

// Favorites
loadFavoriteBtn.addEventListener("click", applyFavorite);
favoriteSelect.addEventListener("change", updateFavoriteActions);
presetSelect.addEventListener("change", () => { applyPresetBtn.disabled = !PRESETS[presetSelect.value]; });
saveFavoriteBtn.addEventListener("click", openSaveFavoriteModal);
deleteFavoriteBtn.addEventListener("click", deleteFavorite);
confirmSaveFavoriteBtn.addEventListener("click", () => {
  const name = favoriteName.value.trim();
  if (!name) {
    showToast("Enter a name");
    return;
  }
  saveFavorite(name);
});
cancelSaveFavoriteBtn.addEventListener("click", closeSaveFavoriteModalFn);
closeSaveFavoriteModal.addEventListener("click", closeSaveFavoriteModalFn);

cancelBtn.addEventListener("click", cancelCurrentRequest);

// GraphQL mode toggle
gqlToggleBtn.addEventListener("click", () => setGqlMode(!gqlMode));

// Update preview when GQL variables change
gqlVariables.addEventListener("input", () => {
  debouncedUpdatePreview();
  debouncedSaveState();
});

// Environment selector
envSelect.addEventListener("change", () => {
  currentOptions.activeEnvironment = envSelect.value;
  // Persist the active environment choice
  chrome.storage.sync.get("options", ({ options }) => {
    const newOptions = { ...DEFAULT_OPTIONS, ...(options || {}), activeEnvironment: envSelect.value };
    chrome.storage.sync.set({ options: newOptions });
  });
  updateEnvVarCount();
  updatePreview();
});

// Auth
authTemplateBtn.addEventListener("click", openAuthModal);
applyAuthBtn.addEventListener("click", applyAuthTemplate);
cancelAuthBtn.addEventListener("click", closeAuthModalFn);
closeAuthModal.addEventListener("click", closeAuthModalFn);
authType.addEventListener("change", () => {
  bearerFields.style.display = "none";
  basicFields.style.display = "none";
  apikeyFields.style.display = "none";
  
  const type = authType.value;
  if (type === "bearer") {
    bearerFields.style.display = "flex";
  } else if (type === "basic") {
    basicFields.style.display = "flex";
  } else if (type.startsWith("apikey")) {
    apikeyFields.style.display = "flex";
  }
});

// Close modals on backdrop click
authModal.addEventListener("click", (e) => {
  if (e.target === authModal) closeAuthModalFn();
});
saveFavoriteModal.addEventListener("click", (e) => {
  if (e.target === saveFavoriteModal) closeSaveFavoriteModalFn();
});
helpModal.addEventListener("click", (e) => {
  if (e.target === helpModal) closeHelpModalFn();
});

// Help modal
helpBtn.addEventListener("click", openHelpModal);
closeHelpModal.addEventListener("click", closeHelpModalFn);
closeHelpModalBtn.addEventListener("click", closeHelpModalFn);

// Confirmation modal
confirmModalOkBtn.addEventListener("click", () => {
  const cb = _confirmCallback;
  closeConfirmModal();
  if (cb) cb();
});
confirmModalCancelBtn.addEventListener("click", closeConfirmModal);
confirmModal.addEventListener("click", (e) => {
  if (e.target === confirmModal) closeConfirmModal();
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl+Enter or Cmd+Enter: Send request
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !document.querySelector(".modal.show")) {
    e.preventDefault();
    if (!isRequestInFlight) sendRequest();
    return;
  }
  
  // Escape: Close modals
  if (e.key === "Escape") {
    if (confirmModal.classList.contains("show")) {
      closeConfirmModal();
      return;
    }
    if (authModal.classList.contains("show")) {
      closeAuthModalFn();
      return;
    }
    if (saveFavoriteModal.classList.contains("show")) {
      closeSaveFavoriteModalFn();
      return;
    }
    if (helpModal.classList.contains("show")) {
      closeHelpModalFn();
      return;
    }
  }
  if (document.querySelector(".modal.show")) return;
  const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.target.isContentEditable;
  const plainKey = !e.ctrlKey && !e.metaKey && !e.altKey;
  
  // ?: Show help (only if not in input field)
  if (e.key === "?" && plainKey && !isTyping) {
    e.preventDefault();
    openHelpModal();
    return;
  }
  
  // T: Toggle theme (only if not in input field)
  if (e.key.toLowerCase() === "t" && plainKey && !isTyping) {
    e.preventDefault();
    cycleTheme();
    return;
  }
  
  // O: Open in new tab (only if not in input field)
  if (e.key.toLowerCase() === "o" && plainKey && !isTyping) {
    e.preventDefault();
    openRequestTab();
    return;
  }
  
  // Ctrl+K or Cmd+K: Focus URL field
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    urlEl.focus();
    urlEl.select();
    return;
  }
});

// Enter key in modal inputs
favoriteName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    confirmSaveFavoriteBtn.click();
  }
});

// Re-apply options and history when changed from the options page while popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.options) {
    const newOpts = changes.options.newValue || {};
    currentOptions = { ...DEFAULT_OPTIONS, ...newOpts };
    maxHistory = clampHistorySize(currentOptions.historySize ?? DEFAULT_OPTIONS.historySize);
    favorites = Array.isArray(currentOptions.favorites) ? currentOptions.favorites : [];
    applyTheme(currentOptions.theme);
    renderFavorites();
    renderEnvSelect();
    renderHistory();
    updatePreview();
  }
  if (area === "sync" && changes.environments) {
    currentEnvironments = Array.isArray(changes.environments.newValue) ? changes.environments.newValue : [];
    renderEnvSelect();
    renderHistory();
    updatePreview();
  }
  if (area === "local" && changes.history) {
    historyItems = Array.isArray(changes.history.newValue) ? changes.history.newValue : [];
    renderHistory();
  }
});

window.addEventListener("pagehide", () => {
  saveState();
  abortBackgroundRequest(activeRequestId);
});
