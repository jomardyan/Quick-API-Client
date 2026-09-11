require("../popup/validators.js");
const { validateJSON, validateXML, validateHTML } = window.QuickValidators;

describe("validateJSON", () => {
  test("accepts a valid JSON object", () => {
    const result = validateJSON('{"name":"Ada","age":36}');
    expect(result.valid).toBe(true);
    expect(result.message).toMatch(/valid json/i);
  });

  test("accepts a valid JSON array", () => {
    const result = validateJSON("[1,2,3]");
    expect(result.valid).toBe(true);
  });

  test("accepts a JSON string primitive", () => {
    expect(validateJSON('"hello"').valid).toBe(true);
  });

  test("accepts a JSON number", () => {
    expect(validateJSON("42").valid).toBe(true);
  });

  test("rejects trailing comma", () => {
    const result = validateJSON('{"a":1,}');
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Invalid JSON");
  });

  test("rejects unclosed brace", () => {
    const result = validateJSON('{"a":1');
    expect(result.valid).toBe(false);
  });

  test("rejects empty string", () => {
    const result = validateJSON("   ");
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Empty input.");
  });

  test("rejects plain text", () => {
    expect(validateJSON("hello world").valid).toBe(false);
  });

  test("includes a detail string for valid input", () => {
    const result = validateJSON("[1,2,3]");
    expect(result.detail).toBeDefined();
    expect(result.detail.length).toBeGreaterThan(0);
  });

  test("includes error detail for invalid input", () => {
    const result = validateJSON("{bad json}");
    expect(result.detail).toBeDefined();
  });
});

// ── XML validator tests ────────────────────────────────────────────────────

describe("validateXML", () => {
  test("accepts well-formed XML", () => {
    const result = validateXML(
      '<?xml version="1.0"?><root><item id="1">Hello</item></root>'
    );
    expect(result.valid).toBe(true);
    expect(result.message).toMatch(/valid xml/i);
  });

  test("accepts simple element", () => {
    expect(validateXML("<foo>bar</foo>").valid).toBe(true);
  });

  test("rejects XML with mismatched tags", () => {
    const result = validateXML("<root><child></root>");
    expect(result.valid).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateXML("").valid).toBe(false);
    expect(validateXML("").message).toBe("Empty input.");
  });

  test("detail reports element count for valid XML", () => {
    const result = validateXML("<a><b/></a>");
    expect(result.detail).toMatch(/element/i);
  });
});

// ── HTML validator tests ───────────────────────────────────────────────────

describe("validateHTML", () => {
  test("always reports valid:true (error-tolerant parser)", () => {
    // Browsers recover from malformed HTML
    expect(validateHTML("<html><body><p>test</p></body></html>").valid).toBe(true);
  });

  test("handles fragment without doctype", () => {
    const result = validateHTML("<div><span>hello</span></div>");
    expect(result.valid).toBe(true);
    expect(result.detail).toMatch(/element/i);
  });

  test("rejects empty string", () => {
    expect(validateHTML("").valid).toBe(false);
    expect(validateHTML("").message).toBe("Empty input.");
  });

  test("reports element count > 0 for non-trivial HTML", () => {
    const result = validateHTML("<html><body><p>hi</p><p>bye</p></body></html>");
    const match = result.detail.match(/^(\d+) element/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThan(0);
  });
});
