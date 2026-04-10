/**
 * Tests for popup/share.js — encode / decode functions.
 */

// ── encode / decode (mirrors share.js internals) ─────────────────────────

const FORMAT_VERSION = 1;

function encode(snap) {
  const json = JSON.stringify(snap);
  return btoa(unescape(encodeURIComponent(json)));
}

function decode(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded.trim())));
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || !obj.method || !obj.url) return null;
    return obj;
  } catch (_) {
    return null;
  }
}

// ── Fixture ───────────────────────────────────────────────────────────────

const BASE_SNAP = {
  v: FORMAT_VERSION,
  method: "POST",
  url: "https://api.example.com/users",
  query: [{ key: "format", value: "json" }],
  headers: [{ key: "Authorization", value: "Bearer tok" }],
  body: '{"name":"Ada"}',
  gqlMode: false,
  gqlVariables: "",
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("share encode / decode round-trip", () => {
  test("encode returns a non-empty string", () => {
    const encoded = encode(BASE_SNAP);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
  });

  test("decode recovers the original snapshot", () => {
    const encoded = encode(BASE_SNAP);
    const decoded = decode(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded.method).toBe(BASE_SNAP.method);
    expect(decoded.url).toBe(BASE_SNAP.url);
    expect(decoded.body).toBe(BASE_SNAP.body);
  });

  test("decode preserves query params array", () => {
    const encoded = encode(BASE_SNAP);
    const decoded = decode(encoded);
    expect(decoded.query).toHaveLength(1);
    expect(decoded.query[0]).toEqual({ key: "format", value: "json" });
  });

  test("decode preserves headers array", () => {
    const encoded = encode(BASE_SNAP);
    const decoded = decode(encoded);
    expect(decoded.headers).toHaveLength(1);
    expect(decoded.headers[0].key).toBe("Authorization");
  });

  test("decode handles Unicode characters in URL", () => {
    const unicodeSnap = { ...BASE_SNAP, url: "https://api.example.com/üñïcödé" };
    const encoded = encode(unicodeSnap);
    const decoded = decode(encoded);
    expect(decoded.url).toBe(unicodeSnap.url);
  });

  test("decode handles Unicode in body", () => {
    const unicodeSnap = { ...BASE_SNAP, body: '{"emoji":"🚀"}' };
    const encoded = encode(unicodeSnap);
    const decoded = decode(encoded);
    expect(decoded.body).toBe(unicodeSnap.body);
  });

  test("encode output contains only base64 characters", () => {
    const encoded = encode(BASE_SNAP);
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe("decode with invalid input", () => {
  test("returns null for empty string", () => {
    expect(decode("")).toBeNull();
  });

  test("returns null for random text", () => {
    expect(decode("this is not base64 encoded json")).toBeNull();
  });

  test("returns null for valid base64 but not a request object", () => {
    expect(decode(btoa('"hello"'))).toBeNull();
  });

  test("returns null when method is missing", () => {
    const noMethod = encode({ url: "https://api.example.com" });
    expect(decode(noMethod)).toBeNull();
  });

  test("returns null when url is missing", () => {
    const noUrl = encode({ method: "GET" });
    expect(decode(noUrl)).toBeNull();
  });

  test("trims surrounding whitespace before decoding", () => {
    const encoded = "  " + encode(BASE_SNAP) + "  ";
    expect(decode(encoded)).not.toBeNull();
  });
});
