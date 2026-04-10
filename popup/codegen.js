/**
 * popup/codegen.js — Code snippet generator module
 *
 * Reads the current request form state and generates code in 8 languages.
 * Self-initialising: registers its own click handlers on DOM elements added
 * by popup.html, so popup.js is not touched.
 *
 * Exposes: window.QuickCodegen  (for testing and cross-module use)
 */
(function () {
  "use strict";

  // ── Language registry ──────────────────────────────────────────────────────

  const LANGS = [
    { value: "curl",               label: "cURL / Bash" },
    { value: "python",             label: "Python (requests)" },
    { value: "javascript-fetch",   label: "JavaScript (Fetch API)" },
    { value: "javascript-ajax",    label: "JavaScript / AJAX (jQuery)" },
    { value: "php",                label: "PHP (cURL)" },
    { value: "java",               label: "Java (OkHttp)" },
    { value: "csharp",             label: "C# / .NET (HttpClient)" },
    { value: "node-axios",         label: "Node.js (Axios)" },
  ];

  // ── DOM helpers ────────────────────────────────────────────────────────────

  /**
   * Read the current request form fields and return a normalised state object.
   * This mirrors popup.js's form-reading pattern, but is intentionally copied
   * here so codegen.js has zero dependency on popup.js internals.
   */
  function getRequestState() {
    const method = document.getElementById("method")?.value || "GET";
    const urlInput = (document.getElementById("url")?.value || "").trim();
    const bodyText = document.getElementById("body")?.value || "";

    const query = Array.from(
      document.querySelectorAll("#queryParams .kv-row")
    ).map((row) => ({
      key: (row.querySelector(".kv-key")?.value || "").trim(),
      value: row.querySelector(".kv-value")?.value || "",
    })).filter((p) => p.key);

    const headers = Array.from(
      document.querySelectorAll("#headers .kv-row")
    ).map((row) => ({
      key: (row.querySelector(".kv-key")?.value || "").trim(),
      value: row.querySelector(".kv-value")?.value || "",
    })).filter((h) => h.key);

    // Build the final URL (with scheme + query params)
    let finalUrl = urlInput;
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
      finalUrl = "https://" + finalUrl;
    }
    try {
      const u = new URL(finalUrl);
      query.forEach(({ key, value }) => u.searchParams.set(key, value));
      finalUrl = u.toString();
    } catch (_) { /* keep as-is if URL is invalid */ }

    const isBodyless = ["GET", "HEAD"].includes(method);
    return { method, url: finalUrl, headers, body: isBodyless ? "" : bodyText };
  }

  // ── Snippet generators ─────────────────────────────────────────────────────

  function shellEscape(str) {
    return "'" + str.replace(/'/g, "'\"'\"'") + "'";
  }

  function toHeadersObj(headers) {
    return headers.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  function getContentType(headers) {
    const ct = headers.find((h) => h.key.toLowerCase() === "content-type");
    return ct ? ct.value : "text/plain";
  }

  const generators = {
    curl({ method, url, headers, body }) {
      const lines = ["curl -X " + method + " " + shellEscape(url)];
      headers.forEach(({ key, value }) =>
        lines.push("  -H " + shellEscape(key + ": " + value))
      );
      if (body.trim()) {
        lines.push("  --data-raw " + shellEscape(body));
      }
      return lines.join(" \\\n");
    },

    python({ method, url, headers, body }) {
      const lines = ["import requests", ""];
      const args = [JSON.stringify(url)];
      if (headers.length) {
        lines.push(
          "headers = " + JSON.stringify(toHeadersObj(headers), null, 4),
          ""
        );
        args.push("headers=headers");
      }
      if (body.trim()) {
        lines.push("payload = " + JSON.stringify(body), "");
        args.push("data=payload");
      }
      lines.push(
        "response = requests." +
          method.toLowerCase() +
          "(" +
          args.join(", ") +
          ")"
      );
      lines.push("print(response.status_code)", "print(response.text)");
      return lines.join("\n");
    },

    "javascript-fetch"({ method, url, headers, body }) {
      const opts = { method };
      if (headers.length) opts.headers = toHeadersObj(headers);
      if (body.trim()) opts.body = body;
      return [
        "fetch(" + JSON.stringify(url) + ", " + JSON.stringify(opts, null, 2) + ")",
        "  .then(res => res.json())",
        "  .then(data => console.log(data))",
        "  .catch(err => console.error('Error:', err));",
      ].join("\n");
    },

    "javascript-ajax"({ method, url, headers, body }) {
      const lines = ["$.ajax({"];
      lines.push("  url: " + JSON.stringify(url) + ",");
      lines.push("  method: " + JSON.stringify(method) + ",");
      if (headers.length) {
        lines.push(
          "  headers: " + JSON.stringify(toHeadersObj(headers), null, 4) + ","
        );
      }
      if (body.trim()) {
        lines.push("  data: " + JSON.stringify(body) + ",");
      }
      lines.push("  success: function(data) { console.log(data); },");
      lines.push("  error: function(xhr, err) { console.error(err); }");
      lines.push("});");
      return lines.join("\n");
    },

    php({ method, url, headers, body }) {
      const lines = [
        "<?php",
        "$ch = curl_init();",
        "curl_setopt($ch, CURLOPT_URL, " + JSON.stringify(url) + ");",
        "curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);",
        "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, " + JSON.stringify(method) + ");",
      ];
      if (headers.length) {
        const hs = headers
          .map(({ key, value }) => "    '" + key + ": " + value + "'")
          .join(",\n");
        lines.push("curl_setopt($ch, CURLOPT_HTTPHEADER, [\n" + hs + "\n]);");
      }
      if (body.trim()) {
        lines.push(
          "curl_setopt($ch, CURLOPT_POSTFIELDS, " + JSON.stringify(body) + ");"
        );
      }
      lines.push(
        "$response = curl_exec($ch);",
        "curl_close($ch);",
        "echo $response;"
      );
      return lines.join("\n");
    },

    java({ method, url, headers, body }) {
      const lines = [
        "import okhttp3.*;",
        "",
        "OkHttpClient client = new OkHttpClient();",
        "",
      ];
      let bodyVar = "";
      if (body.trim()) {
        const ct = getContentType(headers);
        lines.push('MediaType mediaType = MediaType.parse("' + ct + '");');
        lines.push(
          "RequestBody body = RequestBody.create(" +
            JSON.stringify(body) +
            ", mediaType);"
        );
        lines.push("");
        bodyVar = "body";
      }
      lines.push("Request request = new Request.Builder()");
      lines.push("  .url(" + JSON.stringify(url) + ")");
      headers.forEach(({ key, value }) =>
        lines.push('  .addHeader("' + key + '", "' + value + '")')
      );
      const m = method.toLowerCase();
      lines.push(bodyVar ? "  ." + m + "(" + bodyVar + ")" : "  ." + m + "()");
      lines.push("  .build();", "");
      lines.push("try (Response response = client.newCall(request).execute()) {");
      lines.push('  System.out.println(response.body().string());');
      lines.push("}");
      return lines.join("\n");
    },

    csharp({ method, url, headers, body }) {
      const lines = ["using var client = new HttpClient();", ""];
      headers.forEach(({ key, value }) =>
        lines.push(
          'client.DefaultRequestHeaders.Add("' + key + '", "' + value + '");'
        )
      );
      if (headers.length) lines.push("");
      const m = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
      if (body.trim()) {
        const ct = getContentType(headers);
        lines.push(
          "var content = new StringContent(" +
            JSON.stringify(body) +
            ', System.Text.Encoding.UTF8, "' +
            ct +
            '");'
        );
        lines.push(
          "var response = await client." +
            m +
            "Async(" +
            JSON.stringify(url) +
            ", content);"
        );
      } else {
        lines.push(
          "var response = await client." + m + "Async(" + JSON.stringify(url) + ");"
        );
      }
      lines.push(
        "var result = await response.Content.ReadAsStringAsync();",
        "Console.WriteLine(result);"
      );
      return lines.join("\n");
    },

    "node-axios"({ method, url, headers, body }) {
      const lines = ["const axios = require('axios');", ""];
      const cfg = [
        "  method: '" + method.toLowerCase() + "',",
        "  url: " + JSON.stringify(url) + ",",
      ];
      if (headers.length) {
        cfg.push(
          "  headers: " + JSON.stringify(toHeadersObj(headers), null, 4) + ","
        );
      }
      if (body.trim()) {
        cfg.push("  data: " + JSON.stringify(body));
      }
      lines.push("axios({", ...cfg, "})");
      lines.push("  .then(res => console.log(JSON.stringify(res.data)))");
      lines.push("  .catch(err => console.error(err));");
      return lines.join("\n");
    },
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  function generate(lang) {
    const state = getRequestState();
    const gen = generators[lang];
    return gen ? gen(state) : "(unsupported language: " + lang + ")";
  }

  window.QuickCodegen = { generate, LANGS, generators };

  // ── Modal UI ───────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    const btn        = document.getElementById("codegenBtn");
    const modal      = document.getElementById("codegenModal");
    const langSelect = document.getElementById("codegenLang");
    const output     = document.getElementById("codegenOutput");
    const copyBtn    = document.getElementById("codegenCopyBtn");
    const closeBtn   = document.getElementById("closeCodegenModal");

    if (!btn || !modal || !langSelect || !output) return;

    // Populate language select on first open
    function populateLangs() {
      if (langSelect.options.length > 0) return;
      LANGS.forEach(({ value, label }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        langSelect.appendChild(opt);
      });
    }

    function refresh() {
      const lang = langSelect.value;
      const snippet = generate(lang);
      output.textContent = snippet;
    }

    function openModal() {
      populateLangs();
      refresh();
      modal.classList.add("show");
      document.body.style.overflow = "hidden";
      langSelect.focus();
    }

    function closeModal() {
      modal.classList.remove("show");
      document.body.style.overflow = "";
      btn.focus();
    }

    btn.addEventListener("click", openModal);
    langSelect.addEventListener("change", refresh);

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(output.textContent);
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1600);
        } catch (_) {
          copyBtn.textContent = "Failed";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1600);
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    const closeBtnFooter = document.getElementById("closeCodegenModalFooter");
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
