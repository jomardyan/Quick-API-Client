/* Isolated demonstration data for captures of the real extension UI. */
module.exports = function installFixtures({ theme, request }) {
  const environments = [
    { name: 'Production', vars: [{ key: 'base_url', value: 'https://api.example.com' }, { key: 'api_version', value: 'v1' }] },
    { name: 'Staging', vars: [{ key: 'base_url', value: 'https://staging.example.com' }, { key: 'api_version', value: 'v1' }] },
  ];
  const favorite = { name: 'List projects', method: 'GET', url: 'https://api.example.com/v1/projects', headers: [{ key: 'Accept', value: 'application/json' }], query: [], body: '' };
  const data = {
    sync: { options: { theme, restoreLast: true, historyEnabled: true, historySize: 8, timeoutMs: 15000, defaultUrl: favorite.url, defaultHeaders: favorite.headers, defaultQuery: [], defaultBody: '', activeEnvironment: 'Production', favorites: [favorite] }, environments },
    local: { lastRequest: request, history: [{ ...favorite, status: 200, time: 142, ts: Date.UTC(2026, 9, 6, 10) }] },
  };
  const listeners = [];
  const storageArea = area => ({
    get(keys, callback) {
      const result = keys == null ? { ...data[area] } : typeof keys === 'string' ? { [keys]: data[area][keys] } : Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, data[area][key]])) : { ...keys, ...data[area] };
      if (callback) callback(result);
      return Promise.resolve(result);
    },
    set(values, callback) {
      const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { oldValue: data[area][key], newValue }]));
      Object.assign(data[area], values);
      if (callback) callback();
      listeners.forEach(listener => listener(changes, area));
      return Promise.resolve();
    },
  });
  window.chrome = {
    storage: { sync: storageArea('sync'), local: storageArea('local'), onChanged: { addListener: listener => listeners.push(listener), removeListener: listener => { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); } } },
    permissions: { contains: (_, callback) => callback(true), request: (_, callback) => callback(true) },
    runtime: {
      lastError: null,
      getURL: file => new URL(file, location.href).href,
      sendMessage(message, callback) {
        if (message.type !== 'api-request') { if (callback) callback(); return; }
        const { url, method, body } = message.payload;
        const graphQL = url.endsWith('/graphql');
        const response = graphQL ? { data: { project: { id: '42', name: 'Browser workspace', status: 'active' } } } : method === 'POST' ? { id: 'proj_042', ...JSON.parse(body), created: true } : { projects: [{ id: 'proj_042', name: 'Browser workspace', status: 'active' }], total: 1 };
        setTimeout(() => callback({ ok: true, status: method === 'POST' && !graphQL ? 201 : 200, statusText: method === 'POST' && !graphQL ? 'Created' : 'OK', type: 'basic', url, headers: [['content-type', 'application/json; charset=utf-8'], ['cache-control', 'no-store']], elapsed: 142, body: JSON.stringify(response, null, 2) }), 40);
      },
    },
    tabs: { create: () => {} },
  };
};
