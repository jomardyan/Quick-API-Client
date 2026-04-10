/**
 * popup/validators.js — Response body validator module
 *
 * Validates response bodies against JSON, XML, HTML, and CSS grammars.
 * Self-initialising: registers its own click handler on #validateBtn.
 *
 * Exposes: window.QuickValidators  (for testing and cross-module use)
 */
(function () {
  "use strict";

  // ── Validators ─────────────────────────────────────────────────────────────

  /**
   * Validate JSON text.
   * @returns {{ valid: boolean, message: string, detail?: string }}
   */
  function validateJSON(text) {
    const trimmed = text.trim();
    if (!trimmed) return { valid: false, message: "Empty input." };
    try {
      JSON.parse(trimmed);
      const bytes = new Blob([trimmed]).size;
      const kb = (bytes / 1024).toFixed(1);
      return {
        valid: true,
        message: "Valid JSON — no errors found.",
        detail: bytes < 1024
          ? bytes + " bytes"
          : kb + " KB",
      };
    } catch (err) {
      // Extract line/col from the error message where available
      const location = err.message.match(/position (\d+)/i);
      const pos = location ? "  at position " + location[1] : "";
      return {
        valid: false,
        message: "Invalid JSON",
        detail: err.message + pos,
      };
    }
  }

  /**
   * Validate XML text using the browser's DOMParser.
   * @returns {{ valid: boolean, message: string, detail?: string }}
   */
  function validateXML(text) {
    const trimmed = text.trim();
    if (!trimmed) return { valid: false, message: "Empty input." };
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, "text/xml");
      const errNode = doc.querySelector("parsererror");
      if (errNode) {
        return {
          valid: false,
          message: "Invalid XML",
          detail: (errNode.textContent || "").trim(),
        };
      }
      const elCount = doc.getElementsByTagName("*").length;
      return {
        valid: true,
        message: "Valid XML — no errors found.",
        detail: elCount + " element" + (elCount !== 1 ? "s" : "") + " parsed.",
      };
    } catch (err) {
      return { valid: false, message: "XML parsing threw an exception.", detail: err.message };
    }
  }

  /**
   * Validate HTML text: always parses (browsers are error-tolerant), but
   * reports structural statistics so the user can verify expectations.
   * @returns {{ valid: boolean, message: string, detail?: string }}
   */
  function validateHTML(text) {
    const trimmed = text.trim();
    if (!trimmed) return { valid: false, message: "Empty input." };
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, "text/html");
      const elCount = doc.querySelectorAll("*").length;
      const title = doc.title ? '"' + doc.title + '"' : "(no title)";
      const hasDoctype = /^<!doctype/i.test(trimmed);
      return {
        valid: true,
        message: "HTML parsed successfully.",
        detail:
          elCount + " element" +
          (elCount !== 1 ? "s" : "") +
          " · title: " + title +
          (hasDoctype ? "" : " · no <!DOCTYPE> declaration"),
      };
    } catch (err) {
      return { valid: false, message: "HTML parsing threw an exception.", detail: err.message };
    }
  }

  /**
   * Validate CSS text by injecting a transient <style> element and reading
   * back the parsed rules. The browser silently drops invalid declarations,
   * so we report a rule count; a zero count for non-empty input is a strong
   * hint of a parsing failure.
   * @returns {{ valid: boolean, message: string, detail?: string }}
   */
  function validateCSS(text) {
    const trimmed = text.trim();
    if (!trimmed) return { valid: false, message: "Empty input." };
    let el = null;
    try {
      el = document.createElement("style");
      el.setAttribute("data-codegen-temp", "1");
      // Use a shadow host to avoid polluting page styles
      const host = document.createElement("div");
      host.style.display = "none";
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: "closed" });
      shadow.appendChild(el);
      el.textContent = trimmed;

      const rules = el.sheet ? el.sheet.cssRules.length : 0;
      document.body.removeChild(host);

      if (rules === 0 && trimmed.includes("{")) {
        return {
          valid: false,
          message: "CSS may contain errors.",
          detail:
            "0 valid rules found — check for missing braces, unknown at-rules, or malformed selectors.",
        };
      }
      return {
        valid: true,
        message: "CSS parsed successfully.",
        detail: rules + " rule" + (rules !== 1 ? "s" : "") + " found.",
      };
    } catch (err) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return { valid: false, message: "CSS validation threw an exception.", detail: err.message };
    }
  }

  // ── Auto-detect content type ────────────────────────────────────────────────

  /**
   * Guess the likely content type from the highlighted response-headers block
   * that popup.js has already rendered into `#responseHeaders`.
   */
  function detectContentType() {
    const headerText = (
      document.getElementById("responseHeaders")?.innerText || ""
    ).toLowerCase();
    if (headerText.includes("application/json") || headerText.includes("text/json")) return "json";
    if (headerText.includes("application/xml") || headerText.includes("text/xml") || headerText.includes("+xml")) return "xml";
    if (headerText.includes("text/html")) return "html";
    if (headerText.includes("text/css")) return "css";
    // Fallback: try to guess from body content
    const body = (document.getElementById("responseBody")?.innerText || "").trimStart();
    if (body.startsWith("{") || body.startsWith("[")) return "json";
    if (body.startsWith("<?xml") || body.startsWith("<") ) return "xml";
    if (/<!doctype\s+html/i.test(body.slice(0, 20))) return "html";
    return "json"; // safe default
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  window.QuickValidators = {
    validateJSON,
    validateXML,
    validateHTML,
    validateCSS,
    detectContentType,
  };

  // ── Modal UI ────────────────────────────────────────────────────────────────

  (function init() {
    const validateBtn = document.getElementById("validateBtn");
    const modal       = document.getElementById("validateModal");
    const typeSelect  = document.getElementById("validateType");
    const resultEl    = document.getElementById("validateResult");
    const runBtn      = document.getElementById("runValidateBtn");
    const closeBtn    = document.getElementById("closeValidateModal");

    if (!validateBtn || !modal) return;

    function getBodyText() {
      return document.getElementById("responseBody")?.innerText || "";
    }

    function runValidation() {
      const type = typeSelect.value;
      const text = getBodyText();
      let result;
      switch (type) {
        case "json":  result = validateJSON(text);  break;
        case "xml":   result = validateXML(text);   break;
        case "html":  result = validateHTML(text);  break;
        case "css":   result = validateCSS(text);   break;
        default:      result = { valid: false, message: "Unknown type." }; break;
      }
      renderResult(result);
    }

    function renderResult(result) {
      resultEl.innerHTML = "";

      const icon = document.createElement("span");
      icon.className = "validate-icon";
      icon.textContent = result.valid ? "✓" : "✕";

      const msg = document.createElement("p");
      msg.className = "validate-message " + (result.valid ? "validate-ok" : "validate-err");
      msg.textContent = result.message;

      resultEl.appendChild(icon);
      resultEl.appendChild(msg);

      if (result.detail) {
        const detail = document.createElement("pre");
        detail.className = "validate-detail";
        detail.textContent = result.detail;
        resultEl.appendChild(detail);
      }
    }

    function openModal() {
      // Auto-select the most likely type
      const detected = detectContentType();
      typeSelect.value = detected;
      runValidation();
      modal.classList.add("show");
      document.body.style.overflow = "hidden";
      runBtn.focus();
    }

    function closeModal() {
      modal.classList.remove("show");
      document.body.style.overflow = "";
      validateBtn.focus();
    }

    validateBtn.addEventListener("click", openModal);
    runBtn.addEventListener("click", runValidation);
    typeSelect.addEventListener("change", runValidation);

    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    const closeBtnFooter = document.getElementById("closeValidateModalFooter");
    if (closeBtnFooter) {
      closeBtnFooter.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("show")) closeModal();
    });
  }());
})();
