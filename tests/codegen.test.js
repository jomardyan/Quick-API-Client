/**
 * Tests for popup/codegen.js — pure generator functions.
 * We extract the pure generator internals for unit testing.
 */

// ── Helpers (mirrors codegen.js internals) ─────────────────────────────────

function shellEscape(str) {
  return "'" + str.replace(/'/g, "'\"'\"'") + "'";
}

function toHeadersObj(headers) {
  return headers.reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {});
}

function getContentType(headers) {
  const ct = headers.find((h) => h.key.toLowerCase() === "content-type");
  return ct ? ct.value : "text/plain";
}

function codegenCurl({ method, url, headers, body }) {
  const lines = ["curl -X " + method + " " + shellEscape(url)];
  headers.forEach(({ key, value }) =>
    lines.push("  -H " + shellEscape(key + ": " + value))
  );
  if (body.trim()) lines.push("  --data-raw " + shellEscape(body));
  return lines.join(" \\\n");
}

function codegenPython({ method, url, headers, body }) {
  const lines = ["import requests", ""];
  const args = [JSON.stringify(url)];
  if (headers.length) { lines.push("headers = " + JSON.stringify(toHeadersObj(headers), null, 4), ""); args.push("headers=headers"); }
  if (body.trim()) { lines.push("payload = " + JSON.stringify(body), ""); args.push("data=payload"); }
  lines.push("response = requests." + method.toLowerCase() + "(" + args.join(", ") + ")");
  lines.push("print(response.status_code)", "print(response.text)");
  return lines.join("\n");
}

function codegenFetch({ method, url, headers, body }) {
  const opts = { method };
  if (headers.length) opts.headers = toHeadersObj(headers);
  if (body.trim()) opts.body = body;
  return [
    "fetch(" + JSON.stringify(url) + ", " + JSON.stringify(opts, null, 2) + ")",
    "  .then(res => res.json())",
    "  .then(data => console.log(data))",
    "  .catch(err => console.error('Error:', err));",
  ].join("\n");
}

function codegenPhp({ method, url, headers, body }) {
  const lines = [
    "<?php",
    "$ch = curl_init();",
    "curl_setopt($ch, CURLOPT_URL, " + JSON.stringify(url) + ");",
    "curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);",
    "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, " + JSON.stringify(method) + ");",
  ];
  if (headers.length) {
    const hs = headers.map(({ key, value }) => "    '" + key + ": " + value + "'").join(",\n");
    lines.push("curl_setopt($ch, CURLOPT_HTTPHEADER, [\n" + hs + "\n]);");
  }
  if (body.trim()) lines.push("curl_setopt($ch, CURLOPT_POSTFIELDS, " + JSON.stringify(body) + ");");
  lines.push("$response = curl_exec($ch);", "curl_close($ch);", "echo $response;");
  return lines.join("\n");
}

function codegenJava({ method, url, headers, body }) {
  const lines = ["import okhttp3.*;", "", "OkHttpClient client = new OkHttpClient();", ""];
  const requestHeaders = headers.filter(({ key }) => key.toLowerCase() !== "content-type");
  let bodyVar = "null";
  if (body.trim()) {
    const ct = getContentType(headers);
    lines.push('MediaType mediaType = MediaType.parse("' + ct + '");');
    lines.push("RequestBody body = RequestBody.create(" + JSON.stringify(body) + ", mediaType);");
    lines.push("");
    bodyVar = "body";
  }
  lines.push("Request request = new Request.Builder()");
  lines.push("  .url(" + JSON.stringify(url) + ")");
  requestHeaders.forEach(({ key, value }) => lines.push('  .addHeader("' + key + '", "' + value + '")'));
  lines.push('  .method("' + method + '", ' + bodyVar + ")");
  lines.push("  .build();", "");
  lines.push("try (Response response = client.newCall(request).execute()) {");
  lines.push("  System.out.println(response.body().string());");
  lines.push("}");
  return lines.join("\n");
}

function codegenCsharp({ method, url, headers, body }) {
  const requestHeaders = headers.filter(({ key }) => key.toLowerCase() !== "content-type");
  const lines = ["using var client = new HttpClient();", ""];
  lines.push(
    "var request = new HttpRequestMessage(new HttpMethod(" + JSON.stringify(method) + "), " + JSON.stringify(url) + ");"
  );
  requestHeaders.forEach(({ key, value }) =>
    lines.push('request.Headers.TryAddWithoutValidation("' + key + '", "' + value + '");')
  );
  if (body.trim()) {
    const ct = getContentType(headers);
    lines.push(
      "request.Content = new StringContent(" + JSON.stringify(body) + ', System.Text.Encoding.UTF8, "' + ct + '");'
    );
  }
  lines.push("", "var response = await client.SendAsync(request);");
  lines.push("var result = await response.Content.ReadAsStringAsync();", "Console.WriteLine(result);");
  return lines.join("\n");
}

function codegenNodeAxios({ method, url, headers, body }) {
  const lines = ["const axios = require('axios');", ""];
  const cfg = ["  method: '" + method.toLowerCase() + "',", "  url: " + JSON.stringify(url) + ","];
  if (headers.length) cfg.push("  headers: " + JSON.stringify(toHeadersObj(headers), null, 4) + ",");
  if (body.trim()) cfg.push("  data: " + JSON.stringify(body));
  lines.push("axios({", ...cfg, "})");
  lines.push("  .then(res => console.log(JSON.stringify(res.data)))");
  lines.push("  .catch(err => console.error(err));");
  return lines.join("\n");
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("shellEscape", () => {
  test("wraps bare string in single quotes", () => {
    expect(shellEscape("hello world")).toBe("'hello world'");
  });
  test("escapes embedded single quotes", () => {
    expect(shellEscape("it's")).toBe("'it'\"'\"'s'");
  });
  test("handles empty string", () => {
    expect(shellEscape("")).toBe("''");
  });
});

describe("toHeadersObj", () => {
  test("converts array to object", () => {
    const result = toHeadersObj([
      { key: "Accept", value: "application/json" },
      { key: "X-Token", value: "abc" },
    ]);
    expect(result).toEqual({ Accept: "application/json", "X-Token": "abc" });
  });
  test("returns empty object for empty array", () => {
    expect(toHeadersObj([])).toEqual({});
  });
});

describe("getContentType", () => {
  test("returns header value when present", () => {
    expect(getContentType([{ key: "Content-Type", value: "application/json" }])).toBe("application/json");
  });
  test("is case-insensitive for key lookup", () => {
    expect(getContentType([{ key: "content-type", value: "text/xml" }])).toBe("text/xml");
  });
  test("defaults to text/plain", () => {
    expect(getContentType([])).toBe("text/plain");
  });
});

describe("codegenCurl", () => {
  const base = { method: "GET", url: "https://api.example.com/users", headers: [], body: "" };

  test("produces a minimal GET snippet", () => {
    const output = codegenCurl(base);
    expect(output).toContain("curl -X GET");
    expect(output).toContain("'https://api.example.com/users'");
  });

  test("includes -H flag for each header", () => {
    const output = codegenCurl({
      ...base,
      headers: [{ key: "Authorization", value: "Bearer tok" }],
    });
    expect(output).toContain("-H 'Authorization: Bearer tok'");
  });

  test("includes --data-raw for POST with body", () => {
    const output = codegenCurl({
      method: "POST",
      url: "https://api.example.com/users",
      headers: [],
      body: '{"name":"Ada"}',
    });
    expect(output).toContain("--data-raw");
    expect(output).toContain("Ada");
  });

  test("omits --data-raw when body is empty", () => {
    const output = codegenCurl({ ...base, method: "POST", body: "" });
    expect(output).not.toContain("--data-raw");
  });
});

describe("codegenPython", () => {
  test("generates import requests line", () => {
    const output = codegenPython({
      method: "GET",
      url: "https://api.example.com",
      headers: [],
      body: "",
    });
    expect(output).toContain("import requests");
    expect(output).toContain("requests.get(");
  });

  test("includes headers dict when headers are present", () => {
    const output = codegenPython({
      method: "GET",
      url: "https://api.example.com",
      headers: [{ key: "Accept", value: "application/json" }],
      body: "",
    });
    expect(output).toContain("headers =");
    expect(output).toContain("headers=headers");
  });

  test("includes payload for POST", () => {
    const output = codegenPython({
      method: "POST",
      url: "https://api.example.com",
      headers: [],
      body: '{"x":1}',
    });
    expect(output).toContain("payload =");
    expect(output).toContain("data=payload");
  });
});

describe("codegenFetch", () => {
  test("generates fetch call", () => {
    const output = codegenFetch({ method: "GET", url: "https://api.example.com", headers: [], body: "" });
    expect(output).toContain("fetch(");
    expect(output).toContain(".then(res => res.json())");
  });

  test("includes body in opts for POST", () => {
    const output = codegenFetch({
      method: "POST",
      url: "https://api.example.com",
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: '{"key":"val"}',
    });
    expect(output).toContain('"body"');
  });
});

describe("codegenPhp", () => {
  test("generates PHP curl init", () => {
    const output = codegenPhp({ method: "GET", url: "https://api.example.com", headers: [], body: "" });
    expect(output).toContain("<?php");
    expect(output).toContain("curl_init()");
    expect(output).toContain("CURLOPT_URL");
  });

  test("sets CURLOPT_HTTPHEADER when headers supplied", () => {
    const output = codegenPhp({
      method: "GET",
      url: "https://api.example.com",
      headers: [{ key: "Accept", value: "application/json" }],
      body: "",
    });
    expect(output).toContain("CURLOPT_HTTPHEADER");
    expect(output).toContain("Accept: application/json");
  });
});

describe("codegenJava", () => {
  test("uses .method() so HEAD requests compile (OkHttp has no .head(body) shorthand issue)", () => {
    const output = codegenJava({ method: "HEAD", url: "https://api.example.com", headers: [], body: "" });
    expect(output).toContain('.method("HEAD", null)');
    expect(output).not.toMatch(/\.head\(/);
  });

  test("uses .method() for OPTIONS, which OkHttp's Request.Builder has no shorthand for", () => {
    const output = codegenJava({ method: "OPTIONS", url: "https://api.example.com", headers: [], body: "" });
    expect(output).toContain('.method("OPTIONS", null)');
    expect(output).not.toMatch(/\.options\(/);
  });

  test("passes the body variable for POST", () => {
    const output = codegenJava({
      method: "POST",
      url: "https://api.example.com",
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: '{"a":1}',
    });
    expect(output).toContain('.method("POST", body)');
    expect(output).toContain("RequestBody.create(");
  });

  test("omits Content-Type from addHeader calls since it's derived from the body's MediaType", () => {
    const output = codegenJava({
      method: "POST",
      url: "https://api.example.com",
      headers: [{ key: "Content-Type", value: "application/json" }, { key: "Accept", value: "application/json" }],
      body: '{"a":1}',
    });
    expect(output).not.toContain('.addHeader("Content-Type"');
    expect(output).toContain('.addHeader("Accept"');
  });
});

describe("codegenCsharp", () => {
  test("uses HttpRequestMessage + SendAsync so every verb (including HEAD/OPTIONS) compiles", () => {
    const head = codegenCsharp({ method: "HEAD", url: "https://api.example.com", headers: [], body: "" });
    expect(head).toContain('new HttpMethod("HEAD")');
    const options = codegenCsharp({ method: "OPTIONS", url: "https://api.example.com", headers: [], body: "" });
    expect(options).toContain('new HttpMethod("OPTIONS")');
  });

  test("does not add Content-Type via DefaultRequestHeaders/request.Headers, which throws at runtime", () => {
    const output = codegenCsharp({
      method: "POST",
      url: "https://api.example.com",
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: '{"a":1}',
    });
    expect(output).not.toContain('request.Headers.TryAddWithoutValidation("Content-Type"');
    expect(output).not.toContain("DefaultRequestHeaders");
    expect(output).toContain("request.Content = new StringContent(");
    expect(output).toContain('"application/json"');
  });

  test("adds non-content headers via TryAddWithoutValidation", () => {
    const output = codegenCsharp({
      method: "GET",
      url: "https://api.example.com",
      headers: [{ key: "Authorization", value: "Bearer tok" }],
      body: "",
    });
    expect(output).toContain('request.Headers.TryAddWithoutValidation("Authorization", "Bearer tok");');
  });
});

describe("codegenNodeAxios", () => {
  test("generates require axios line", () => {
    const output = codegenNodeAxios({ method: "GET", url: "https://api.example.com", headers: [], body: "" });
    expect(output).toContain("require('axios')");
    expect(output).toContain("method: 'get'");
  });

  test("includes data for POST", () => {
    const output = codegenNodeAxios({
      method: "POST",
      url: "https://api.example.com",
      headers: [],
      body: '{"a":1}',
    });
    expect(output).toContain("data:");
  });
});
