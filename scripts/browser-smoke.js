/* Runs the packaged extension against a local HTTP fixture, without external API traffic. */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-api-smoke-'));
  const extension = path.join(temp, 'extension');
  fs.mkdirSync(extension);
  const manifest = require('../manifest.json');
  const archive = path.resolve(__dirname, `../dist/quick-api-client-v${manifest.version}.zip`);
  execFileSync('unzip', ['-q', archive, '-d', extension]);
  // Pregrant only the local fixture host so browser permission UI does not block automation.
  const testManifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  testManifest.host_permissions = ['http://127.0.0.1/*'];
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(testManifest));
  const received = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      received.push({ path: req.url, body, headers: req.headers, method: req.method });
      if (req.url === '/slow') {
        const timer = setTimeout(() => res.end('late'), 1500);
        res.on('close', () => clearTimeout(timer));
      } else if (req.url === '/empty') {
        res.writeHead(204); res.end();
      } else if (req.url === '/error') {
        res.writeHead(422, { 'Content-Type': 'application/json' }); res.end('{"error":"validation"}');
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ body, method: req.method, url: req.url }));
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let context;
  try {
    context = await chromium.launchPersistentContext(path.join(temp, 'profile'), {
      executablePath: chromium.executablePath(), headless: true,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-sandbox'],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/popup.html?tab=1`);
    await page.waitForFunction(() => document.getElementById('url').value !== '');
    await page.locator('#url').fill(base + '/echo');
    await page.locator('#method').selectOption('POST');
    await page.locator('#body').fill('  { "n": 9007199254740993 }  ');
    await page.locator('#sendBtn').click();
    await page.waitForFunction(() => document.getElementById('statusBadge').textContent.startsWith('200'));
    assert.equal(received.at(-1).body, '  { "n": 9007199254740993 }  ');
    assert.equal(await page.locator('#timingPanel').isVisible(), true);

    await page.locator('#gqlToggleBtn').click();
    await page.locator('#body').fill('query { user { id } }');
    await page.locator('#gqlVariables').fill('{"id":42}');
    await page.locator('#sendBtn').click();
    await page.waitForFunction(() => document.getElementById('sendBtn').disabled === false);
    assert.deepEqual(JSON.parse(received.at(-1).body), { query: 'query { user { id } }', variables: { id: 42 } });
    assert.equal(received.at(-1).headers['content-type'], 'application/json');
    const snippets = await page.evaluate(() => ({ curl: window.buildCurl(), generated: window.QuickCodegen.generate('curl') }));
    assert.equal(snippets.curl, snippets.generated);
    const roundtrip = await page.evaluate(() => {
      const snapshot = window.QuickShare.snapshot();
      const decoded = window.QuickShare.decode(window.QuickShare.encode(snapshot));
      return window.QuickShare.applySnapshot(decoded) && document.getElementById('gqlVariables').value;
    });
    assert.equal(roundtrip, '{"id":42}');

    await page.locator('#gqlToggleBtn').click();
    await page.locator('#url').fill(base + '/slow');
    await page.locator('#sendBtn').click();
    await page.locator('#cancelBtn').click();
    await page.locator('#url').fill(base + '/error');
    await page.locator('#sendBtn').click();
    await page.waitForFunction(() => document.getElementById('statusBadge').textContent.startsWith('422'));
    await page.locator('#url').fill(base + '/empty');
    await page.locator('#sendBtn').click();
    await page.waitForFunction(() => document.getElementById('statusBadge').textContent.startsWith('204'));
    assert.equal(await page.locator('#responseBody').textContent(), '');
    const css = await page.evaluate(() => window.QuickValidators.validateCSS('body { color: red; }'));
    assert.equal(css.valid, true);
    assert.equal(await page.locator('style[data-codegen-temp]').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Chromium package smoke passed - real worker requests, raw body, GraphQL, cURL, sharing, cancel/resend, HTTP 422/204, timing, CSS and no page errors');
  } finally {
    if (context) await context.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
