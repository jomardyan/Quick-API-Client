/* Shared request preparation for sending, previewing and code generation. */
(function () {
  "use strict";
  const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  function buildUrl(raw, query = []) {
    let value = String(raw || "").trim();
    if (!value || /\{\{[^}]+\}\}/.test(value)) return null;
    if (!/^https?:\/\//i.test(value)) {
      // A host with a numeric port is not a URI scheme.
      if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^[^/:]+:\d+(?:[/?#]|$)/.test(value)) return null;
      value = `https://${value}`;
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      const replaced = new Set();
      for (const { key, value } of query) {
        if (!replaced.has(key)) url.searchParams.delete(key);
        replaced.add(key);
        url.searchParams.append(key, value);
      }
      url.hash = "";
      return url.toString();
    } catch (_) { return null; }
  }
  function substituteVars(text, vars = []) {
    const values = new Map(vars.map(({ key, value }) => [key, value]));
    return String(text || "").replace(/\{\{([^}]+)\}\}/g,
      (match, name) => values.has(name.trim()) ? String(values.get(name.trim())) : match);
  }
  function prepare(state, vars = []) {
    const method = state.gqlMode ? "POST" : state.method;
    if (!METHODS.includes(method)) throw new Error("Unsupported HTTP method");
    const replace = text => substituteVars(text, vars);
    const query = (state.query || []).map(({ key, value }) => ({ key: replace(key), value: replace(value) }));
    const url = buildUrl(replace(state.url), query);
    if (!url) throw new Error("Enter a valid HTTP or HTTPS URL and resolve its environment variables");
    const headers = [];
    for (const item of state.headers || []) {
      const key = replace(item.key).trim();
      const value = replace(item.value);
      if (!/^[!#$%&'*+.^_`|~\w-]+$/.test(key) || /[\r\n\0]/.test(value)) throw new Error("Invalid request header");
      const index = headers.findIndex(h => h.key.toLowerCase() === key.toLowerCase());
      if (index >= 0) headers[index] = { key, value };
      else headers.push({ key, value });
    }
    let body = ["GET", "HEAD"].includes(method) ? "" : replace(state.body);
    if (state.gqlMode) {
      let variables;
      try { variables = JSON.parse(replace(state.gqlVariables).trim() || "{}"); }
      catch (_) { throw new Error("GraphQL variables must be valid JSON"); }
      if (!variables || Array.isArray(variables) || typeof variables !== "object") throw new Error("GraphQL variables must be a JSON object");
      body = JSON.stringify({ query: body, variables });
      const index = headers.findIndex(h => h.key.toLowerCase() === "content-type");
      if (index >= 0) headers.splice(index, 1);
      headers.push({ key: "Content-Type", value: "application/json" });
    }
    return { method, url, headers, body };
  }
  window.QuickRequest = { buildUrl, substituteVars, prepare, METHODS };
})();
