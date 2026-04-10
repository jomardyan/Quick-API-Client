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

// Environment selector
const envSelect = document.getElementById("envSelect");
const envVarCount = document.getElementById("envVarCount");

// GraphQL mode
const gqlToggleBtn = document.getElementById("gqlToggleBtn");
const gqlVarsRow = document.getElementById("gqlVarsRow");
const gqlVariables = document.getElementById("gqlVariables");

const isBodyless = (method) => ["GET", "HEAD"].includes(method);
let maxHistory = 8;
let favorites = [];

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

function setGqlMode(enabled) {
  gqlMode = enabled;
  gqlToggleBtn.classList.toggle("primary", enabled);
  gqlToggleBtn.classList.toggle("ghost", !enabled);
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

/**
 * Replace {{VAR_NAME}} tokens with values from the active environment.
 * Unresolved tokens are left as-is so the user sees the problem clearly.
 */
function substituteVars(text, vars) {
  if (!text || !vars.length) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, name) => {
    const entry = vars.find((v) => v.key === name.trim());
    return entry !== undefined ? entry.value : match;
  });
}

function getActiveEnvVars() {
  const envName = currentOptions.activeEnvironment || "";
  if (!envName || !currentEnvironments.length) return [];
  const env = currentEnvironments.find((e) => e.name === envName);
  return env ? (env.vars || []) : [];
}

function renderEnvSelect() {
  const current = envSelect.value;
  envSelect.innerHTML = '<option value="">No environment</option>';
  currentEnvironments.forEach((env) => {
    const opt = document.createElement("option");
    opt.value = env.name;
    opt.textContent = env.name;
    envSelect.appendChild(opt);
  });
  // Restore prior selection or active env from options
  const desired = current || currentOptions.activeEnvironment || "";
  envSelect.value = desired;
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

  const valInput = document.createElement("input");
  valInput.type = "text";
  valInput.className = "kv-value";
  valInput.placeholder = "Value";
  valInput.value = value;

  const removeBtn = document.createElement("button");
  removeBtn.className = "ghost small remove";
  removeBtn.title = "Remove";
  removeBtn.textContent = "✕";

  [keyInput, valInput].forEach((input) =>
    ["input", "change"].forEach((evt) =>
      input.addEventListener(evt, () => {
        debouncedUpdatePreview();
        debouncedSaveState();
      })
    )
  );

  removeBtn.addEventListener("click", () => {
    row.remove();
    updatePreview();
    saveState();
  });

  row.append(keyInput, valInput, removeBtn);
  container.appendChild(row);
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

function buildUrl(rawUrl, queryParams) {
  let normalized = rawUrl.trim();
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  let urlObj;
  try {
    urlObj = new URL(normalized);
  } catch (err) {
    return null;
  }
  queryParams.forEach(({ key, value }) => urlObj.searchParams.set(key, value));
  return urlObj.toString();
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
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
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

function saveState() {
  const state = {
    method: methodEl.value,
    url: urlEl.value,
    query: readKV(queryListEl),
    headers: readKV(headersListEl),
    body: bodyEl.value,
    gqlMode,
    gqlVariables: gqlVariables.value,
  };
  chrome.storage.local.set({ lastRequest: state });
}

function applyTheme(themeChoice) {
  const resolved =
    themeChoice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : themeChoice;
  document.body.dataset.theme = resolved;
  const label =
    themeChoice === "system"
      ? `Theme: Auto (${resolved})`
      : `Theme: ${themeChoice.charAt(0).toUpperCase()}${themeChoice.slice(1)}`;
  themeBtn.textContent = label;
}

function loadOptions() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["options", "environments"], ({ options, environments }) => {
      currentOptions = { ...DEFAULT_OPTIONS, ...(options || {}) };
      maxHistory = clampHistorySize(currentOptions.historySize ?? DEFAULT_OPTIONS.historySize);
      favorites = currentOptions.favorites || [];
      currentEnvironments = environments || [];
      applyTheme(currentOptions.theme);
      renderFavorites();
      renderEnvSelect();
      chrome.storage.local.get("history", ({ history }) => {
        historyItems = history || [];
        renderHistory();
        resolve(currentOptions);
      });
    });
  });
}

function restoreState() {
  chrome.storage.local.get("lastRequest", ({ lastRequest }) => {
    const useLast = currentOptions.restoreLast && lastRequest;
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
      setGqlMode(true);
      gqlVariables.value = base.gqlVariables || "";
    }
    updatePreview();
  });
}

function updatePreview() {
  const method = methodEl.value;
  const query = readKV(queryListEl);
  const headers = readKV(headersListEl);
  const url = buildUrl(urlEl.value, query);

  const headerLines = headers.map(({ key, value }) => `${key}: ${value}`);
  const parts = [
    `${method} ${url || "(invalid URL)"} HTTP/1.1`,
    headerLines.length ? headerLines.join("\n") : "",
    isBodyless(method) ? "" : bodyEl.value.trim(),
  ].filter(Boolean);

  requestPreviewEl.textContent = parts.join("\n\n");
  document.getElementById("bodyHint").textContent = gqlMode
    ? "GraphQL query string"
    : isBodyless(method)
    ? "Ignored for GET/HEAD"
    : "Sends raw text; JSON is auto-formatted if valid";
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
    chrome.permissions.contains({ origins: [origin] }, (has) => {
      if (has) return resolve(true);
      chrome.permissions.request({ origins: [origin] }, (granted) => resolve(Boolean(granted)));
    });
  });
}

function renderFavorites() {
  favoriteSelect.innerHTML = "";
  if (!favorites || favorites.length === 0) {
    favoriteSelect.innerHTML = '<option value="">No favorites saved yet</option>';
    return;
  }
  favoriteSelect.innerHTML = '<option value="">Select a favorite…</option>';
  favorites.forEach((fav, idx) => {
    const option = document.createElement("option");
    option.value = idx;
    option.textContent = fav.name;
    favoriteSelect.appendChild(option);
  });
}

function saveFavorite(name) {
  const method = methodEl.value;
  const query = readKV(queryListEl);
  const headers = readKV(headersListEl);
  const url = urlEl.value;
  const body = bodyEl.value;

  // Warn if any header looks like a credential (stored plaintext in sync storage)
  const sensitivePatterns = ["authorization", "x-api-key", "api-key", "x-auth-token", "x-access-token"];
  const hasCredential = headers.some(({ key }) => sensitivePatterns.includes(key.toLowerCase()));

  const favorite = { name, method, url, query, headers, body };
  favorites.push(favorite);

  chrome.storage.sync.get("options", ({ options }) => {
    const newOptions = { ...DEFAULT_OPTIONS, ...(options || {}), favorites };
    chrome.storage.sync.set({ options: newOptions }, () => {
      if (chrome.runtime.lastError) {
        favorites.pop(); // roll back optimistic push
        showToast("Save failed: storage quota exceeded");
        return;
      }
      renderFavorites();
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
  updatePreview();
  saveState();
}

function deleteFavorite() {
  const idx = favoriteSelect.value;
  if (!idx || !favorites[idx]) {
    showToast("Select a favorite to delete");
    return;
  }
  
  // Create a simple confirmation via modal would be better, but using confirm for simplicity
  // TODO: Replace with a proper confirmation modal for better UX
  if (!confirm(`Delete "${favorites[idx].name}"?`)) return;
  
  favorites.splice(idx, 1);
  chrome.storage.sync.get("options", ({ options }) => {
    const newOptions = { ...DEFAULT_OPTIONS, ...(options || {}), favorites };
    chrome.storage.sync.set({ options: newOptions }, () => {
      if (chrome.runtime.lastError) {
        showToast("Delete failed: " + chrome.runtime.lastError.message);
        return;
      }
      renderFavorites();
      showToast("Favorite deleted");
    });
  });
}

function openAuthModal() {
  authModal.classList.add("show");
  authType.focus();
  // Trap focus in modal
  document.body.style.overflow = "hidden";
}

function closeAuthModalFn() {
  authModal.classList.remove("show");
  document.body.style.overflow = "";
  // Clear inputs
  bearerToken.value = "";
  basicUsername.value = "";
  basicPassword.value = "";
  apiKeyName.value = "";
  apiKeyValue.value = "";
  authTemplateBtn.focus();
}

const MODAL_TRANSITION_DELAY = 100; // Allow time for modal show animation before focusing

function openSaveFavoriteModal() {
  saveFavoriteModal.classList.add("show");
  document.body.style.overflow = "hidden";
  // Use setTimeout to ensure modal is visible before focusing
  setTimeout(() => favoriteName.focus(), MODAL_TRANSITION_DELAY);
}

function closeSaveFavoriteModalFn() {
  saveFavoriteModal.classList.remove("show");
  document.body.style.overflow = "";
  favoriteName.value = "";
  saveFavoriteBtn.focus();
}

function openHelpModal() {
  helpModal.classList.add("show");
  document.body.style.overflow = "hidden";
  closeHelpModalBtn.focus();
}

function closeHelpModalFn() {
  helpModal.classList.remove("show");
  document.body.style.overflow = "";
  helpBtn.focus();
}

function applyAuthTemplate() {
  const type = authType.value;
  
  if (type === "bearer") {
    const token = bearerToken.value.trim();
    if (!token) {
      showToast("Enter a token");
      return;
    }
    createKVRow(headersListEl, "Authorization", `Bearer ${token}`);
    showToast("Bearer auth added");
  } else if (type === "basic") {
    const username = basicUsername.value.trim();
    const password = basicPassword.value.trim();
    if (!username || !password) {
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
      createKVRow(headersListEl, "Authorization", `Basic ${encoded}`);
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
    createKVRow(headersListEl, keyName, keyValue);
    showToast("API key added");
  } else if (type === "apikey-query") {
    const keyName = apiKeyName.value.trim();
    const keyValue = apiKeyValue.value.trim();
    if (!keyName || !keyValue) {
      showToast("Enter key name and value");
      return;
    }
    createKVRow(queryListEl, keyName, keyValue);
    showToast("API key added");
  }
  
  closeAuthModalFn();
  updatePreview();
  saveState();
}

function renderHistory() {
  historyListEl.innerHTML = "";
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
  historyItems.forEach((item) => {
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
        setGqlMode(true);
        gqlVariables.value = item.gqlVariables || "";
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
}

function cancelCurrentRequest() {
  if (!isRequestInFlight) return;
  if (activeRequestId) {
    chrome.runtime.sendMessage({
      type: "cancel-request",
      payload: { requestId: activeRequestId },
    });
  }
  clearSendingState();
  statusBadge.textContent = "Cancelled";
  statusBadge.className = "badge warn";
  responseMeta.textContent = "Request cancelled by user.";
  showToast("Request cancelled");
}

async function sendRequest() {
  if (isRequestInFlight) return; // prevent concurrent sends
  try {
    const method = methodEl.value;
    const envVars = getActiveEnvVars();
    const query = readKV(queryListEl);
    const headers = readKV(headersListEl);

    // Apply environment variable substitution to URL components before parsing
    const rawUrl = substituteVars(urlEl.value, envVars);
    const substitutedQuery = query.map(({ key, value }) => ({
      key,
      value: substituteVars(value, envVars),
    }));
    let finalUrl = buildUrl(rawUrl, substitutedQuery);

    if (!finalUrl) {
      statusBadge.textContent = "Invalid URL";
      statusBadge.className = "badge err";
      showToast("Enter a valid URL");
      return;
    }

    // Validate URL format
    try {
      new URL(finalUrl);
    } catch (err) {
      statusBadge.textContent = "Invalid URL";
      statusBadge.className = "badge err";
      showToast("URL format is invalid");
      return;
    }

    const origin = originFromUrl(finalUrl);
    const allowed = await ensureOriginPermission(origin);
    if (!allowed) {
      statusBadge.textContent = "Permission denied";
      statusBadge.className = "badge err";
      responseMeta.textContent = "Allow host permission to send this request.";
      showToast("Permission denied");
      return;
    }

    // Apply env var substitution to header values
    const headersObj = headers.reduce((acc, { key, value }) => {
      acc[key] = substituteVars(value, envVars);
      return acc;
    }, {});

    let body = substituteVars(bodyEl.value, envVars);
    if (isBodyless(method)) {
      body = undefined;
    } else if (gqlMode) {
      // In GraphQL mode, build the standard {query, variables} envelope
      const query_str = body || "";
      let variables = {};
      const rawVars = substituteVars(gqlVariables.value.trim(), envVars);
      if (rawVars) {
        try {
          variables = JSON.parse(rawVars);
        } catch (err) {
          statusBadge.textContent = "GQL Error";
          statusBadge.className = "badge err";
          showToast("GraphQL variables: invalid JSON");
          return;
        }
      }
      body = JSON.stringify({ query: query_str, variables });
      headersObj["Content-Type"] = "application/json";
    } else if (
      headersObj["Content-Type"]?.includes("application/json") &&
      body && body.trim()
    ) {
      try {
        body = JSON.stringify(JSON.parse(body));
      } catch (err) {
        // Keep as-is if not valid JSON.
      }
    }

    // Show loading state and mark in-flight
    isRequestInFlight = true;
    activeRequestId = crypto.randomUUID();
    sendBtn.disabled = true;
    sendBtnBottom.disabled = true;
    sendBtn.classList.add("loading");
    sendBtnBottom.classList.add("loading");
    cancelBtn.style.display = "";

    statusBadge.textContent = "Sending...";
    statusBadge.className = "badge muted";
    responseMeta.textContent = "";
    responseHeaders.textContent = "";
    responseBody.textContent = "";

    // Guard: if the service worker is killed mid-request, the callback never fires.
    // After timeout + 5 s we recover the UI instead of hanging forever.
    const effectiveTimeout = currentOptions.timeoutMs || 15000;
    swGuardTimeoutId = setTimeout(() => {
      clearSendingState();
      statusBadge.textContent = "SW Error";
      statusBadge.className = "badge err";
      responseMeta.textContent = "Background was restarted mid-request. Please try again.";
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
        clearSendingState();
        if (chrome.runtime.lastError) {
          statusBadge.textContent = "Error";
          statusBadge.className = "badge err";
          responseMeta.textContent = "Connection error";
          responseBody.textContent = chrome.runtime.lastError.message;
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
        const isJson =
          (res.headers || []).some(
            ([k, v]) => k.toLowerCase() === "content-type" && v.toLowerCase().includes("json")
          ) ||
          (() => {
            try {
              JSON.parse(res.body || "");
              return true;
            } catch (err) {
              return false;
            }
          })();
        if (isJson) {
          const pretty = prettifyJsonMaybe(res.body || "");
          responseBody.innerHTML = highlightJson(pretty);
          responseBody.dataset.lang = "json";
        } else {
          responseBody.textContent = res.body || "";
          responseBody.dataset.lang = "text";
        }
        
        showToast(statusClass === "ok" ? "Success" : "Request completed");

        if (currentOptions.historyEnabled !== false && maxHistory > 0) {
          const now = new Date();
          const timestamp = `${now.toLocaleDateString()} ${now
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            .toString()}`;
          const entry = {
            method,
            url: finalUrl,
            headers,
            query,
            body: bodyEl.value,
            gqlMode,
            gqlVariables: gqlVariables.value,
            timestamp,
          };
          historyItems = [entry, ...historyItems].slice(0, maxHistory);
          chrome.storage.local.set({ history: historyItems });
          renderHistory();
        }
      }
    );

    saveState();
  } catch (err) {
    console.error("sendRequest error:", err);
    clearSendingState();
    statusBadge.textContent = "Client Error";
    statusBadge.className = "badge err";
    responseBody.textContent = err.message;
    showToast("Error occurred");
  }
}

function shellEscape(str) {
  return `'${str.replace(/'/g, `'\"'\"'`)}'`;
}

function buildCurl() {
  const method = methodEl.value;
  const query = readKV(queryListEl);
  const headers = readKV(headersListEl);
  const finalUrl = buildUrl(urlEl.value, query) || urlEl.value;
  const lines = [`curl -X ${method} ${shellEscape(finalUrl)}`];

  headers.forEach(({ key, value }) => lines.push(`  -H ${shellEscape(`${key}: ${value}`)}`));

  if (!isBodyless(method) && bodyEl.value.trim()) {
    lines.push(`  --data ${shellEscape(bodyEl.value)}`);
  }

  return lines.join(" \\\n");
}

async function copyCurl() {
  const text = buildCurl();
  try {
    await navigator.clipboard.writeText(text);
    statusBadge.textContent = "cURL copied";
    statusBadge.className = "badge ok";
    showToast("cURL copied");
  } catch (err) {
    statusBadge.textContent = "Clipboard blocked";
    statusBadge.className = "badge warn";
    showToast("Clipboard blocked");
  }
}

function resetForm() {
  methodEl.value = "GET";
  urlEl.value = currentOptions.defaultUrl || "";
  queryListEl.innerHTML = "";
  headersListEl.innerHTML = "";
  bodyEl.value = currentOptions.defaultBody || "";

  (currentOptions.defaultQuery?.length ? currentOptions.defaultQuery : [{}]).forEach(
    ({ key = "", value = "" }) => createKVRow(queryListEl, key, value)
  );
  (currentOptions.defaultHeaders?.length ? currentOptions.defaultHeaders : [{}]).forEach(
    ({ key = "", value = "" }) => createKVRow(headersListEl, key, value)
  );

  statusBadge.textContent = "Waiting";
  statusBadge.className = "badge muted";
  responseMeta.textContent = "";
  responseHeaders.textContent = "";
  responseBody.textContent = "";

  updatePreview();
  saveState();
}

function cycleTheme() {
  const order = ["system", "dark", "light"];
  const idx = order.indexOf(currentOptions.theme);
  const next = order[(idx + 1) % order.length];
  currentOptions.theme = next;
  chrome.storage.sync.get("options", ({ options }) => {
    const newOptions = { ...DEFAULT_OPTIONS, ...(options || {}), theme: next };
    chrome.storage.sync.set({ options: newOptions }, () => {
      applyTheme(next);
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
  updatePreview();
  saveState();
}

function clearHistory() {
  historyItems = [];
  chrome.storage.local.set({ history: historyItems });
  renderHistory();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    statusBadge.textContent = "Copied";
    statusBadge.className = "badge ok";
    showToast("Copied");
  } catch (err) {
    statusBadge.textContent = "Clipboard blocked";
    statusBadge.className = "badge warn";
    showToast("Clipboard blocked");
  }
}

function downloadBody() {
  const blob = new Blob([responseBody.innerText || ""], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "response.txt";
  a.click();
  // Defer revocation to allow the browser to initiate the download first
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1600);
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
  createKVRow(queryListEl);
});

addHeaderBtn.addEventListener("click", () => {
  createKVRow(headersListEl);
});

sendBtn.addEventListener("click", sendRequest);
sendBtnBottom.addEventListener("click", sendRequest);
copyCurlBtn.addEventListener("click", copyCurl);
clearBtn.addEventListener("click", resetForm);
themeBtn.addEventListener("click", cycleTheme);
applyPresetBtn.addEventListener("click", applyPreset);
clearHistoryBtn.addEventListener("click", clearHistory);
copyHeadersBtn.addEventListener("click", () => copyText(responseHeaders.innerText));
copyBodyBtn.addEventListener("click", () => copyText(responseBody.innerText));
saveBodyBtn.addEventListener("click", downloadBody);

// Favorites
loadFavoriteBtn.addEventListener("click", applyFavorite);
saveFavoriteBtn.addEventListener("click", openSaveFavoriteModal);
deleteFavoriteBtn.addEventListener("click", deleteFavorite);
confirmSaveFavoriteBtn.addEventListener("click", () => {
  const name = favoriteName.value.trim();
  if (!name) {
    showToast("Enter a name");
    return;
  }
  saveFavorite(name);
  closeSaveFavoriteModalFn();
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

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl+Enter or Cmd+Enter: Send request
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!isRequestInFlight) sendRequest();
    return;
  }
  
  // Escape: Close modals
  if (e.key === "Escape") {
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
  
  // ?: Show help (only if not in input field)
  if (e.key === "?" && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
    e.preventDefault();
    openHelpModal();
    return;
  }
  
  // T: Toggle theme (only if not in input field)
  if (e.key === "t" && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
    e.preventDefault();
    cycleTheme();
    return;
  }
  
  // O: Open in new tab (only if not in input field)
  if (e.key === "o" && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
    e.preventDefault();
    window.open("popup.html?tab=1", "_blank");
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

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (currentOptions.theme === "system") {
    applyTheme("system");
  }
});

// Re-apply options and history when changed from the options page while popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.options) {
    const newOpts = changes.options.newValue || {};
    currentOptions = { ...DEFAULT_OPTIONS, ...newOpts };
    maxHistory = clampHistorySize(currentOptions.historySize ?? DEFAULT_OPTIONS.historySize);
    favorites = currentOptions.favorites || [];
    applyTheme(currentOptions.theme);
    renderFavorites();
    renderEnvSelect();
  }
  if (area === "sync" && changes.environments) {
    currentEnvironments = changes.environments.newValue || [];
    renderEnvSelect();
  }
  if (area === "local" && changes.history) {
    historyItems = changes.history.newValue || [];
    renderHistory();
  }
});
