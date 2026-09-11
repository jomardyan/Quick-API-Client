require("../popup/timing.js");
const { parseElapsed, getTier, formatBytes } = window.QuickTiming;

describe("getTier", () => {
  test("< 200 ms = Excellent", () => {
    expect(getTier(0).label).toBe("Excellent");
    expect(getTier(100).label).toBe("Excellent");
    expect(getTier(199).label).toBe("Excellent");
  });

  test("200–499 ms = Good", () => {
    expect(getTier(200).label).toBe("Good");
    expect(getTier(499).label).toBe("Good");
  });

  test("500–999 ms = Fair", () => {
    expect(getTier(500).label).toBe("Fair");
    expect(getTier(999).label).toBe("Fair");
  });

  test("1000–2999 ms = Slow", () => {
    expect(getTier(1000).label).toBe("Slow");
    expect(getTier(2999).label).toBe("Slow");
  });

  test(">= 3000 ms = Very slow", () => {
    expect(getTier(3000).label).toBe("Very slow");
    expect(getTier(10000).label).toBe("Very slow");
  });

  test("returns a color hex string", () => {
    const tier = getTier(50);
    expect(tier.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ── formatBytes ───────────────────────────────────────────────────────────

describe("formatBytes", () => {
  test("0 bytes", () => expect(formatBytes(0)).toBe("0 B"));
  test("< 1 KB shows bytes", () => expect(formatBytes(512)).toBe("512 B"));
  test("exactly 1 KB", () => expect(formatBytes(1024)).toBe("1.0 KB"));
  test("fractional KB", () => expect(formatBytes(2048)).toBe("2.0 KB"));
  test("MB range", () => expect(formatBytes(1024 * 1024)).toBe("1.00 MB"));
  test("large file", () => {
    const result = formatBytes(5 * 1024 * 1024);
    expect(result).toContain("MB");
  });
});

// ── parseElapsed ──────────────────────────────────────────────────────────

describe("parseElapsed", () => {
  test("parses elapsed from standard responseMeta format", () => {
    expect(parseElapsed("150ms • CORS • https://api.example.com/")).toBe(150);
  });

  test("parses four-digit elapsed", () => {
    expect(parseElapsed("1234ms • BASIC • https://api.example.com/")).toBe(1234);
  });

  test("returns null for empty string", () => {
    expect(parseElapsed("")).toBeNull();
  });

  test("returns null for undefined", () => {
    expect(parseElapsed(undefined)).toBeNull();
  });

  test("returns null when no ms marker", () => {
    expect(parseElapsed("Sending...")).toBeNull();
    expect(parseElapsed("Waiting")).toBeNull();
  });

  test("returns null when ms is not at start", () => {
    // Should only match at beginning of string
    expect(parseElapsed("prefix 100ms suffix")).toBeNull();
  });
});
