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

  // Use the same prepared payload as the network request and preview.
  function getRequestState() {
    return window.prepareRequest();
  }

  // ── Snippet generators ─────────────────────────────────────────────────────

  function shellEscape(str) {
    return "'" + str.replace(/'/g, "'\"'\"'") + "'";
  }

  function toHeadersObj(headers) {
    return headers.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, Object.create(null));
  }

  function getContentType(headers) {
    const ct = headers.find((h) => h.key.toLowerCase() === "content-type");
    return ct ? ct.value : "text/plain";
  }

  function phpString(value) {
    return "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }

  const generators = {
    curl({ method, url, headers, body }) {
      const lines = ["curl -X " + method + " " + shellEscape(url)];
      headers.forEach(({ key, value }) =>
        lines.push("  -H " + shellEscape(key + ": " + value))
      );
      if (body.length) {
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
      if (body.length) {
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
      if (body.length) opts.body = body;
      return [
        "fetch(" + JSON.stringify(url) + ", " + JSON.stringify(opts, null, 2) + ")",
        "  .then(res => res.text())",
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
      if (body.length) {
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
        "curl_setopt($ch, CURLOPT_URL, " + phpString(url) + ");",
        "curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);",
        "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, " + phpString(method) + ");",
      ];
      if (headers.length) {
        const hs = headers
          .map(({ key, value }) => "    " + phpString(key + ": " + value))
          .join(",\n");
        lines.push("curl_setopt($ch, CURLOPT_HTTPHEADER, [\n" + hs + "\n]);");
      }
      if (body.length) {
        lines.push(
          "curl_setopt($ch, CURLOPT_POSTFIELDS, " + phpString(body) + ");"
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
      // Content-Type is derived from the request body, not sent via addHeader,
      // since OkHttp reads it from the RequestBody's MediaType.
      const requestHeaders = headers.filter(
        ({ key }) => key.toLowerCase() !== "content-type"
      );
      let bodyVar = "null";
      if (body.length || ["POST", "PUT", "PATCH"].includes(method)) {
        const ct = getContentType(headers);
        lines.push('MediaType mediaType = MediaType.parse(' + JSON.stringify(ct) + ');');
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
      requestHeaders.forEach(({ key, value }) =>
        lines.push('  .addHeader(' + JSON.stringify(key) + ', ' + JSON.stringify(value) + ')')
      );
      // .method() works for every HTTP verb (including HEAD/OPTIONS, which have
      // no dedicated builder shorthand), unlike .get()/.post()/etc.
      lines.push('  .method("' + method + '", ' + bodyVar + ")");
      lines.push("  .build();", "");
      lines.push("try (Response response = client.newCall(request).execute()) {");
      lines.push('  System.out.println(response.body().string());');
      lines.push("}");
      return lines.join("\n");
    },

    csharp({ method, url, headers, body }) {
      // Content-Type is a content header: HttpRequestMessage.Headers throws if
      // it's added there, so it's attached to the StringContent instead.
      const requestHeaders = headers.filter(
        ({ key }) => key.toLowerCase() !== "content-type"
      );
      const lines = ["using var client = new HttpClient();", ""];
      lines.push(
        "var request = new HttpRequestMessage(new HttpMethod(" +
          JSON.stringify(method) +
          "), " +
          JSON.stringify(url) +
          ");"
      );
      requestHeaders.forEach(({ key, value }) =>
        lines.push(
          'request.Headers.TryAddWithoutValidation(' + JSON.stringify(key) + ', ' + JSON.stringify(value) + ');'
        )
      );
      if (body.length) {
        const ct = getContentType(headers).split(";")[0].trim();
        lines.push(
          "request.Content = new StringContent(" +
            JSON.stringify(body) +
            ', System.Text.Encoding.UTF8, ' +
            JSON.stringify(ct) +
            ');'
        );
      }
      lines.push(
        "",
        "var response = await client.SendAsync(request);",
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
      if (body.length) {
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
    try {
      const state = getRequestState();
      const gen = generators[lang];
      return gen ? gen(state) : "(unsupported language: " + lang + ")";
    } catch (err) { return err.message; }
  }

  window.QuickCodegen = { generate, LANGS, generators };

  // ── Modal UI ───────────────────────────────────────────────────────────────

  (function init() {
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
  }());
})();
