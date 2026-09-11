require('../popup/request.js');
const { prepare, buildUrl } = window.QuickRequest;
const base = { method: 'POST', url: 'https://example.com', body: '  { "n": 9007199254740993 }  ', headers: [], query: [] };

test('raw JSON and whitespace remain byte-for-byte intact', () => {
  expect(prepare({ ...base, headers: [{ key: 'content-type', value: 'application/json' }] }).body).toBe(base.body);
});
test.each(['javascript:alert(1)', 'file:///tmp/data', 'ftp://example.com', 'https://user:pass@example.com', '{{HOST}}/a'])('rejects unsupported URL %s', url => {
  expect(buildUrl(url)).toBeNull();
});
test('preserves duplicate query values while replacing URL values', () => {
  expect(buildUrl('http://localhost:3000/a?tag=old&keep=1#hash', [{ key: 'tag', value: 'one' }, { key: 'tag', value: 'two' }])).toBe('http://localhost:3000/a?keep=1&tag=one&tag=two');
});
test('GraphQL mode shares substituted envelope with exports and overrides content type once', () => {
  const result = prepare({ ...base, method: 'GET', gqlMode: true, url: '{{HOST}}/gql', body: 'query { users }', gqlVariables: '{"id":"{{ID}}"}', headers: [{ key: 'content-type', value: 'text/plain' }] }, [{ key: 'HOST', value: 'https://example.com' }, { key: 'ID', value: '42' }]);
  expect(result.method).toBe('POST');
  expect(JSON.parse(result.body)).toEqual({ query: 'query { users }', variables: { id: '42' } });
  expect(result.headers).toEqual([{ key: 'Content-Type', value: 'application/json' }]);
});
test.each(['null', '[]', '42', 'invalid'])('rejects invalid GraphQL variables %s', gqlVariables => {
  expect(() => prepare({ ...base, gqlMode: true, gqlVariables })).toThrow(/GraphQL/);
});
test('headers reject CRLF and handle duplicate names case insensitively', () => {
  expect(() => prepare({ ...base, headers: [{ key: 'X-Token', value: 'value\r\nInjected: yes' }] })).toThrow();
  expect(prepare({ ...base, headers: [{ key: 'Authorization', value: 'old' }, { key: 'authorization', value: 'new' }] }).headers).toEqual([{ key: 'authorization', value: 'new' }]);
});
