const fs = require('fs');
const path = require('path');
require('./load-popup')();
const { buildUrl, substituteVars } = window.QuickRequest;
const { prettifyJsonMaybe, shellEscape, clampHistorySize } = window;
// Read the actual options parser in its own context, without bootstrapping its UI.
const source = fs.readFileSync(path.join(__dirname, '../options.js'), 'utf8');
const parser = source.slice(source.indexOf('function parseKVText('), source.indexOf('function kvToDisplay('));
window.eval(parser);
const { parseKVText } = window;
const isBodyless = method => window.QuickRequest.prepare({ method, url: "https://example.com", body: "payload" }).body === "";

describe("buildUrl", () => {
  test("returns full URL with query params appended", () => {
    const result = buildUrl("https://api.example.com/users", [
      { key: "page", value: "2" },
    ]);
    expect(result).toBe("https://api.example.com/users?page=2");
  });

  test("prepends https:// when scheme is missing", () => {
    const result = buildUrl("api.example.com/users", []);
    expect(result).toContain("https://api.example.com/users");
  });

  test("returns null for invalid URL", () => {
    expect(buildUrl("not a url at all !!!", [])).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(buildUrl("", [])).toBeNull();
  });

  test("handles multiple query params", () => {
    const result = buildUrl("https://api.example.com/search", [
      { key: "q", value: "hello world" },
      { key: "limit", value: "10" },
    ]);
    expect(result).toContain("q=hello+world");
    expect(result).toContain("limit=10");
  });

  test("preserves existing query params in the URL", () => {
    const result = buildUrl("https://api.example.com/search?existing=1", [
      { key: "new", value: "2" },
    ]);
    expect(result).toContain("existing=1");
    expect(result).toContain("new=2");
  });

  test("handles URLs with http:// scheme intact", () => {
    const result = buildUrl("http://localhost:3000/api", []);
    expect(result).toBe("http://localhost:3000/api");
  });
});

// ── prettifyJsonMaybe ─────────────────────────────────────────────────────────

describe("prettifyJsonMaybe", () => {
  test("pretty-prints valid JSON", () => {
    const result = prettifyJsonMaybe('{"a":1,"b":2}');
    expect(result).toBe(JSON.stringify({ a: 1, b: 2 }, null, 2));
  });

  test("returns original text for invalid JSON", () => {
    const text = "not json at all";
    expect(prettifyJsonMaybe(text)).toBe(text);
  });

  test("returns original text for partial JSON", () => {
    const text = '{"a": 1,';
    expect(prettifyJsonMaybe(text)).toBe(text);
  });

  test("handles empty string", () => {
    expect(prettifyJsonMaybe("")).toBe("");
  });

  test("handles JSON array", () => {
    const result = prettifyJsonMaybe("[1,2,3]");
    expect(result).toBe(JSON.stringify([1, 2, 3], null, 2));
  });
});

// ── shellEscape ───────────────────────────────────────────────────────────────

describe("shellEscape", () => {
  test("wraps string in single quotes", () => {
    expect(shellEscape("hello")).toBe("'hello'");
  });

  test("escapes single quotes", () => {
    const result = shellEscape("it's a test");
    expect(result).toBe("'it'\"'\"'s a test'");
  });

  test("handles URL with special characters", () => {
    const result = shellEscape("https://api.example.com/search?q=hello world");
    expect(result).toBe("'https://api.example.com/search?q=hello world'");
  });

  test("handles empty string", () => {
    expect(shellEscape("")).toBe("''");
  });
});

// ── isBodyless ────────────────────────────────────────────────────────────────

describe("isBodyless", () => {
  test("GET is bodyless", () => expect(isBodyless("GET")).toBe(true));
  test("HEAD is bodyless", () => expect(isBodyless("HEAD")).toBe(true));
  test("POST is not bodyless", () => expect(isBodyless("POST")).toBe(false));
  test("PUT is not bodyless", () => expect(isBodyless("PUT")).toBe(false));
  test("DELETE is not bodyless", () => expect(isBodyless("DELETE")).toBe(false));
  test("PATCH is not bodyless", () => expect(isBodyless("PATCH")).toBe(false));
  test("OPTIONS is not bodyless", () => expect(isBodyless("OPTIONS")).toBe(false));
});

// ── substituteVars ────────────────────────────────────────────────────────────

describe("substituteVars", () => {
  const vars = [
    { key: "base_url", value: "https://api.example.com" },
    { key: "version", value: "v2" },
    { key: "token", value: "secret-123" },
  ];

  test("substitutes a single variable", () => {
    expect(substituteVars("{{base_url}}/users", vars)).toBe(
      "https://api.example.com/users"
    );
  });

  test("substitutes multiple variables", () => {
    expect(substituteVars("{{base_url}}/{{version}}/users", vars)).toBe(
      "https://api.example.com/v2/users"
    );
  });

  test("leaves unresolved tokens as-is", () => {
    expect(substituteVars("{{base_url}}/{{unknown}}", vars)).toBe(
      "https://api.example.com/{{unknown}}"
    );
  });

  test("handles empty vars array", () => {
    expect(substituteVars("{{base_url}}/users", [])).toBe("{{base_url}}/users");
  });

  test("handles empty text", () => {
    expect(substituteVars("", vars)).toBe("");
  });

  test("handles null/undefined text gracefully", () => {
    expect(substituteVars(null, vars)).toBe("");
    expect(substituteVars(undefined, vars)).toBe("");
  });

  test("substitutes variable in header value", () => {
    expect(substituteVars("Bearer {{token}}", vars)).toBe("Bearer secret-123");
  });

  test("handles whitespace inside braces", () => {
    expect(substituteVars("{{ base_url }}/users", vars)).toBe(
      "https://api.example.com/users"
    );
  });

  test("does not substitute partial braces", () => {
    const text = "{base_url}/users";
    expect(substituteVars(text, vars)).toBe("{base_url}/users");
  });
});

// ── clampHistorySize ──────────────────────────────────────────────────────────

describe("clampHistorySize", () => {
  test("returns value within bounds", () => {
    expect(clampHistorySize(10)).toBe(10);
  });

  test("clamps to 0 minimum", () => {
    expect(clampHistorySize(-5)).toBe(0);
  });

  test("clamps to 50 maximum", () => {
    expect(clampHistorySize(100)).toBe(50);
  });

  test("returns default 8 for non-finite value", () => {
    expect(clampHistorySize("abc")).toBe(8);
    expect(clampHistorySize(NaN)).toBe(8);
    expect(clampHistorySize(Infinity)).toBe(8);
  });

  test("coerces string numbers", () => {
    expect(clampHistorySize("20")).toBe(20);
  });

  test("handles boundary values exactly", () => {
    expect(clampHistorySize(0)).toBe(0);
    expect(clampHistorySize(50)).toBe(50);
  });
});

// ── parseKVText ───────────────────────────────────────────────────────────────

describe("parseKVText", () => {
  test("parses JSON array format", () => {
    const input = JSON.stringify([
      { key: "Accept", value: "application/json" },
      { key: "X-API-Key", value: "abc123" },
    ]);
    const result = parseKVText(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ key: "Accept", value: "application/json" });
    expect(result[1]).toEqual({ key: "X-API-Key", value: "abc123" });
  });

  test("parses newline key:value format", () => {
    const result = parseKVText("Accept: application/json\nX-Custom: test");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ key: "Accept", value: "application/json" });
    expect(result[1]).toEqual({ key: "X-Custom", value: "test" });
  });

  test("handles colon in value (URL)", () => {
    const result = parseKVText("Location: https://example.com/path");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("https://example.com/path");
  });

  test("returns empty array for empty string", () => {
    expect(parseKVText("")).toHaveLength(0);
  });

  test("filters entries with empty keys", () => {
    const input = JSON.stringify([
      { key: "", value: "orphan" },
      { key: "Valid", value: "yes" },
    ]);
    const result = parseKVText(input);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("Valid");
  });

  test("trims whitespace from keys", () => {
    const result = parseKVText("  Accept  : application/json");
    expect(result[0].key).toBe("Accept");
  });
});
