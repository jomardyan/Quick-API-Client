require("../popup/codegen.js");
const {
  curl: codegenCurl, python: codegenPython, "javascript-fetch": codegenFetch,
  php: codegenPhp, java: codegenJava, csharp: codegenCsharp, "node-axios": codegenNodeAxios,
} = window.QuickCodegen.generators;

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
    expect(output).toContain(".then(res => res.text())");
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

test('Java creates an empty body for methods that require one', () => {
  expect(codegenJava({ method: 'POST', url: 'https://example.com', headers: [], body: '' })).toContain('.method("POST", body)');
});
test('Java and C# escape quoted header values', () => {
  const request = { method: 'GET', url: 'https://example.com', headers: [{ key: 'If-Match', value: '"etag"' }], body: '' };
  expect(codegenJava(request)).toContain('"\\"etag\\""');
  expect(codegenCsharp(request)).toContain('"\\"etag\\""');
});
test('PHP prevents variable interpolation and escapes literal quotes', () => {
  const output = codegenPhp({ method: 'POST', url: 'https://example.com/$id', headers: [{ key: 'X-Name', value: "O'Reilly" }], body: '$secret' });
  expect(output).toContain("'https://example.com/$id'");
  expect(output).toContain("'X-Name: O\\'Reilly'");
  expect(output).toContain("CURLOPT_POSTFIELDS, '$secret'");
});
