/**
 * popup/share.js — Request export / import module
 *
 * Export:  Serialises the current request to a compact base-64 encoded JSON
 *          string and copies it to the clipboard so the user can share it.
 *
 * Import:  Parses the encoded string back into a request spec and restores
 *          all form fields using the global helper functions already defined
 *          by popup.js (createKVRow, updatePreview, saveState), which are
 *          reachable as window globals.
 *
 * Self-initialising: registers its own event listeners on DOM elements added
 * by popup.html.  popup.js is NOT modified.
 *
 * Exposes: window.QuickShare  (for testing and cross-module use)
 */
(function () {
  "use strict";

  // Schema version — increment when the serialised format changes
  const FORMAT_VERSION = 1;

  // ── Serialise ──────────────────────────────────────────────────────────────

  /**
   * Read the current form and return a plain-object snapshot.
   */
  function snapshot() {
    const method = document.getElementById("method")?.value || "GET";
    const url    = document.getElementById("url")?.value    || "";
    const body   = document.getElementById("body")?.value   || "";
    const gqlMode =
      document.getElementById("gqlToggleBtn")?.classList.contains("primary") || false;
    const gqlVariables = document.getElementById("gqlVariables")?.value || "";

    const query = Array.from(
      document.querySelectorAll("#queryParams .kv-row")
    ).map((row) => ({
      key:   (row.querySelector(".kv-key")?.value   || "").trim(),
      value:  row.querySelector(".kv-value")?.value  || "",
    })).filter((p) => p.key);

    const headers = Array.from(
      document.querySelectorAll("#headers .kv-row")
    ).map((row) => ({
      key:   (row.querySelector(".kv-key")?.value   || "").trim(),
      value:  row.querySelector(".kv-value")?.value  || "",
    })).filter((h) => h.key);

    return { v: FORMAT_VERSION, method, url, query, headers, body, gqlMode, gqlVariables };
  }

  /**
   * Encode a snapshot to a URL-safe base-64 string.
   */
  function encode(snap) {
    const json = JSON.stringify(snap);
    // btoa requires a Latin-1 string; use encodeURIComponent + unescape for Unicode safety
    return btoa(unescape(encodeURIComponent(json)));
  }

  /**
   * Decode a base-64 encoded string back to a snapshot.
   * Returns null when the input is not a valid Quick-API-Client export.
   */
  function decode(encoded) {
    try {
      const json = decodeURIComponent(escape(atob(encoded.trim())));
      const obj  = JSON.parse(json);
      if (typeof obj !== "object" || !obj.method || !obj.url) return null;
      return obj;
    } catch (_) {
      return null;
    }
  }

  // ── Apply a snapshot to the form ───────────────────────────────────────────

  /**
   * Restore form fields from a snapshot object.
   * Calls popup.js globals: createKVRow, updatePreview, saveState, setGqlMode
   * (all defined at window scope in popup.js and available to subsequent scripts).
   */
  function applySnapshot(snap) {
    const methodEl  = document.getElementById("method");
    const urlEl     = document.getElementById("url");
    const bodyEl    = document.getElementById("body");
    const queryList = document.getElementById("queryParams");
    const hdrList   = document.getElementById("headers");
    const gqlVarEl  = document.getElementById("gqlVariables");

    if (!methodEl || !urlEl) return false;

    methodEl.value = snap.method || "GET";
    urlEl.value    = snap.url    || "";
    bodyEl.value   = snap.body   || "";

    // Rebuild KV rows using the global helper already exposed by popup.js
    if (typeof createKVRow === "function") {
      queryList.innerHTML = "";
      hdrList.innerHTML   = "";

      const q = snap.query?.length   ? snap.query   : [{}];
      const h = snap.headers?.length ? snap.headers : [{}];
      q.forEach(({ key = "", value = "" }) => createKVRow(queryList, key, value));
      h.forEach(({ key = "", value = "" }) => createKVRow(hdrList,   key, value));
    }

    // GraphQL mode
    if (snap.gqlMode && typeof setGqlMode === "function") {
      setGqlMode(true);
      if (gqlVarEl) gqlVarEl.value = snap.gqlVariables || "";
    } else if (typeof setGqlMode === "function") {
      setGqlMode(false);
    }

    if (typeof updatePreview === "function") updatePreview();
    if (typeof saveState     === "function") saveState();

    return true;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.QuickShare = { snapshot, encode, decode, applySnapshot };

  // ── Modal UI ───────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    const shareBtn    = document.getElementById("shareBtn");
    const modal       = document.getElementById("shareModal");
    const exportOut   = document.getElementById("shareExportOutput");
    const exportCopy  = document.getElementById("shareExportCopyBtn");
    const importIn    = document.getElementById("shareImportInput");
    const importApply = document.getElementById("shareImportApplyBtn");
    const closeBtn    = document.getElementById("closeShareModal");

    if (!shareBtn || !modal) return;

    function openModal() {
      // Refresh the export output every time the modal opens
      if (exportOut) exportOut.value = encode(snapshot());
      modal.classList.add("show");
      document.body.style.overflow = "hidden";
      if (exportOut) exportOut.focus();
    }

    function closeModal() {
      modal.classList.remove("show");
      document.body.style.overflow = "";
      if (importIn) importIn.value = "";
      shareBtn.focus();
    }

    shareBtn.addEventListener("click", openModal);

    if (exportCopy) {
      exportCopy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(exportOut.value);
          exportCopy.textContent = "Copied!";
          setTimeout(() => { exportCopy.textContent = "Copy"; }, 1600);
        } catch (_) {
          exportCopy.textContent = "Failed";
          setTimeout(() => { exportCopy.textContent = "Copy"; }, 1600);
        }
      });
    }

    if (importApply) {
      importApply.addEventListener("click", () => {
        const raw = (importIn?.value || "").trim();
        if (!raw) {
          importApply.textContent = "Paste a code first";
          setTimeout(() => { importApply.textContent = "Import"; }, 1800);
          return;
        }
        const snap = decode(raw);
        if (!snap) {
          importApply.textContent = "Invalid code";
          setTimeout(() => { importApply.textContent = "Import"; }, 1800);
          return;
        }
        const ok = applySnapshot(snap);
        if (ok) {
          closeModal();
          // If showToast is available (popup.js global) use it
          if (typeof showToast === "function") showToast("Request imported");
        } else {
          importApply.textContent = "Apply failed";
          setTimeout(() => { importApply.textContent = "Import"; }, 1800);
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    const closeBtnFooter = document.getElementById("closeShareModalFooter");
    if (closeBtnFooter) {
      closeBtnFooter.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("show")) closeModal();
    });
  });
})();
