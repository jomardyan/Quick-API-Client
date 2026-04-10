/**
 * popup/timing.js — Request timing visualisation module
 *
 * After each response, renders a timing panel below #responseMeta showing:
 *   • Total round-trip time (colour-coded by performance tier)
 *   • A proportional bar scaled to a 5-second window
 *   • Response body size
 *   • Estimated throughput (KB/s)
 *
 * Uses a MutationObserver on #responseMeta to detect new responses without
 * any modification to popup.js.
 *
 * Exposes: window.QuickTiming  (for testing and cross-module use)
 */
(function () {
  "use strict";

  // ── Performance tiers ──────────────────────────────────────────────────────

  const TIERS = [
    { max: 200,   label: "Excellent", color: "#4ade80" },
    { max: 500,   label: "Good",      color: "#a3e635" },
    { max: 1000,  label: "Fair",      color: "#facc15" },
    { max: 3000,  label: "Slow",      color: "#fb923c" },
    { max: Infinity, label: "Very slow", color: "#f87171" },
  ];

  function getTier(ms) {
    return TIERS.find((t) => ms < t.max) || TIERS[TIERS.length - 1];
  }

  // ── Size formatter ─────────────────────────────────────────────────────────

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  // ── Parse elapsed ms from responseMeta text ────────────────────────────────
  // popup.js sets responseMeta to: "150ms • CORS • https://..."

  function parseElapsed(metaText) {
    const match = (metaText || "").match(/^(\d+)ms\b/);
    return match ? parseInt(match[1], 10) : null;
  }

  // ── Render the timing panel ────────────────────────────────────────────────

  function render(panel, elapsed, bodyText) {
    const tier      = getTier(elapsed);
    const barPct    = Math.min(100, (elapsed / 5000) * 100).toFixed(1);
    const size      = new Blob([bodyText]).size;
    const throughput =
      elapsed > 0 ? ((size / 1024) / (elapsed / 1000)).toFixed(1) : "—";

    // Build DOM nodes (no innerHTML with user data only controlled values used)
    panel.innerHTML = "";

    // Row: time + bar
    const timeRow = document.createElement("div");
    timeRow.className = "timing-row";

    const timeLabel = document.createElement("span");
    timeLabel.className = "timing-label";
    timeLabel.textContent = "Total time";

    const timeValue = document.createElement("span");
    timeValue.className = "timing-value";
    timeValue.textContent = elapsed + " ms";
    timeValue.style.color = tier.color;

    const timeTier = document.createElement("span");
    timeTier.className = "timing-rating";
    timeTier.textContent = tier.label;
    timeTier.style.color = tier.color;

    timeRow.append(timeLabel, timeValue, timeTier);

    const barTrack = document.createElement("div");
    barTrack.className = "timing-bar-track";

    const barFill = document.createElement("div");
    barFill.className = "timing-bar-fill";
    barFill.style.width = barPct + "%";
    barFill.style.background = tier.color;
    barTrack.appendChild(barFill);

    // Row: size + throughput
    const sizeRow = document.createElement("div");
    sizeRow.className = "timing-row timing-row-secondary";

    const sizeLabel = document.createElement("span");
    sizeLabel.className = "timing-label";
    sizeLabel.textContent = "Response size";

    const sizeValue = document.createElement("span");
    sizeValue.className = "timing-value";
    sizeValue.textContent = formatBytes(size);

    const tpLabel = document.createElement("span");
    tpLabel.className = "timing-label";
    tpLabel.textContent = "Throughput";

    const tpValue = document.createElement("span");
    tpValue.className = "timing-value";
    tpValue.textContent = throughput === "—" ? "—" : throughput + " KB/s";

    sizeRow.append(sizeLabel, sizeValue, tpLabel, tpValue);

    panel.append(timeRow, barTrack, sizeRow);
    panel.style.display = "";
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.QuickTiming = { parseElapsed, getTier, formatBytes, render };

  // ── MutationObserver setup ─────────────────────────────────────────────────

  (function init() {
    const panel  = document.getElementById("timingPanel");
    const metaEl = document.getElementById("responseMeta");
    const bodyEl = document.getElementById("responseBody");

    if (!panel || !metaEl) return;

    // Hide on reset: popup.js clears responseMeta text to "" before each send
    // and after clear. We watch for that too.
    const observer = new MutationObserver(() => {
      const elapsed = parseElapsed(metaEl.textContent);
      if (elapsed === null) {
        panel.style.display = "none";
        panel.innerHTML = "";
        return;
      }
      render(panel, elapsed, bodyEl ? (bodyEl.innerText || "") : "");
    });

    observer.observe(metaEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }());
})();
