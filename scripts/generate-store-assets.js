/* Reproducible vector artwork and real-UI captures; no external API requests. */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const sharp = require('sharp');
const assert = require('assert/strict');
const installFixtures = require('./store-fixtures');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'store-assets');
const logo = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
const records = [];
const sizes = [16, 20, 24, 32, 48, 64, 96, 128, 256, 512];
const getRequest = { method: 'GET', url: 'https://api.example.com/v1/projects', headers: [{ key: 'Accept', value: 'application/json' }], query: [], body: '' };
const postRequest = { ...getRequest, method: 'POST', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{\n  "name": "Browser workspace",\n  "status": "active"\n}' };
const gqlRequest = { ...postRequest, url: 'https://api.example.com/graphql', gqlMode: true, gqlVariables: '{\n  "id": "42"\n}', body: 'query GetProject($id: ID!) {\n  project(id: $id) { id name status }\n}' };
const shots = [
  { file: '01-rest-dark.png', title: 'Your API. One browser tab.', subtitle: 'Compose requests and inspect JSON, headers, status, and timing.', theme: 'dark', request: getRequest, mode: 'rest' },
  { file: '02-post-light.png', title: 'Build the request you need.', subtitle: 'Work with methods, query parameters, headers, and JSON bodies.', theme: 'light', request: postRequest, mode: 'post' },
  { file: '03-graphql.png', title: 'GraphQL, with variables.', subtitle: 'Send queries and variables from the same familiar workspace.', theme: 'dark', request: gqlRequest, mode: 'gql' },
  { file: '04-code-snippets.png', title: 'Take your request into code.', subtitle: 'Generate a snippet or copy your request as cURL.', theme: 'light', request: postRequest, mode: 'snippets' },
  { file: '05-environments.png', title: 'Switch environments. Keep your flow.', subtitle: 'Reuse variables across URLs, headers, and request bodies.', theme: 'dark', request: getRequest, mode: 'settings' },
  { file: '06-validation.png', title: 'Check your response in a click.', subtitle: 'Parse JSON, XML, HTML, and CSS without leaving the client.', theme: 'dark', request: getRequest, mode: 'validate' },
];

const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const svg = (width, height, content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
function backdrop(width, height) {
  return `<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0C1730"/><stop offset="1" stop-color="#173879"/></linearGradient><radialGradient id="glow"><stop stop-color="#3F7DFA" stop-opacity=".3"/><stop offset="1" stop-color="#3F7DFA" stop-opacity="0"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#bg)"/><ellipse cx="${width * .85}" cy="${height * .1}" rx="${width * .65}" ry="${height * .85}" fill="url(#glow)"/>`;
}
async function save(input, relative, width, height, transparent = false, purpose = '') {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let pipeline = sharp(input).resize(width, height);
  pipeline = transparent ? pipeline.ensureAlpha() : pipeline.flatten({ background: '#0C1730' }).removeAlpha();
  await pipeline.png({ compressionLevel: 9 }).toFile(target);
  const metadata = await sharp(target).metadata();
  assert.equal(metadata.width, width, relative);
  assert.equal(metadata.height, height, relative);
  assert.equal(metadata.hasAlpha, transparent, relative);
  assert.equal(metadata.format, 'png', relative);
  assert.equal(metadata.depth, 'uchar', relative);
  assert.ok(fs.statSync(target).size < 5 * 1024 * 1024, `${relative} exceeds conservative 5 MiB limit`);
  records.push({ file: relative.replaceAll('\\', '/'), width, height, channels: metadata.channels, alpha: metadata.hasAlpha, bytes: fs.statSync(target).size, purpose });
}

async function capture(browser, shot) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'Europe/Warsaw', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(installFixtures, { theme: shot.theme, request: shot.request });
  // Prevent a future change to the fixture from making real outbound requests.
  await page.route(/^https?:\/\//, route => route.abort());
  try {
    const filename = shot.mode === 'settings' ? 'options.html' : 'popup.html';
    await page.goto(pathToFileURL(path.join(root, filename)).href + (filename === 'popup.html' ? '?tab=1' : ''));
    if (shot.mode === 'settings') {
      await page.waitForFunction(() => document.querySelector('#envNameSelect').options.length === 2);
      await page.selectOption('#envNameSelect', '0');
      await page.fill('#envVarsInput', 'base_url: https://api.example.com\napi_version: v1');
      await page.locator('#environments').scrollIntoViewIfNeeded();
    } else {
      await page.waitForFunction(expected => document.querySelector('#url').value === expected, shot.request.url);
      await page.click('#sendBtn');
      await page.waitForFunction(() => /^20[01]/.test(document.querySelector('#statusBadge').textContent));
      await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'));
      assert.ok((await page.locator('#responseBody').textContent()).includes('Browser workspace'), 'Fixture response is visible');
      if (shot.mode === 'post' || shot.mode === 'gql') await page.locator(shot.mode === 'gql' ? '#gqlVariables' : '#body').scrollIntoViewIfNeeded();
      if (shot.mode === 'snippets') {
        await page.click('#codegenBtn');
        await page.selectOption('#codegenLang', 'javascript-fetch');
        await page.locator('#codegenModal').waitFor({ state: 'visible' });
        assert.ok((await page.locator('#codegenOutput').textContent()).includes('fetch('));
      }
      if (shot.mode === 'validate') {
        await page.click('#validateBtn');
        await page.locator('#validateModal').waitFor({ state: 'visible' });
      }
    }
    await page.evaluate(() => document.fonts.ready);
    // A screenshot of the unmodified product, surrounded by separate listing copy.
    await page.mouse.move(0, 0);
    assert.deepEqual(errors, [], `Capture errors for ${shot.file}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Capture must not overflow horizontally');
    const raw = await page.screenshot({ animations: 'disabled' });
    await save(raw, `store-assets/source/screenshots/${shot.file}`, 1280, 720, false, 'Unmodified UI capture with demonstration data');
    const frame = Buffer.from(svg(1280, 800, `${backdrop(1280, 800)}<g font-family="Segoe UI, Arial, sans-serif"><text x="64" y="40" fill="#7DF1CE" font-size="13" letter-spacing="2">QUICK API CLIENT</text><text x="64" y="87" fill="#F5F8FF" font-size="34" font-weight="700">${escape(shot.title)}</text><text x="64" y="119" fill="#B9CBE6" font-size="17">${escape(shot.subtitle)}</text></g><rect x="77" y="145" width="1126" height="634" rx="12" fill="#7D9BC2" fill-opacity=".45"/>`));
    const captureImage = await sharp(raw).resize(1120, 630).toBuffer();
    const composed = await sharp(frame).composite([{ input: captureImage, left: 80, top: 147 }]).toBuffer();
    await save(composed, `store-assets/edge/screenshots/${shot.file}`, 1280, 800, false, shot.title);
    if (shot.mode !== 'validate') await save(composed, `store-assets/chrome/screenshots/${shot.file}`, 1280, 800, false, shot.title);
    console.log(`Captured ${shot.file}`);
  } finally { await context.close(); }
}

async function promotions() {
  // Text-free, full-bleed promotional tiles following Chrome's brand guidance.
  for (const [width, height, file] of [[440, 280, 'promo-small.png'], [1400, 560, 'promo-marquee.png']]) {
    const scale = height / 280;
    const cx = width / 2;
    const cy = height / 2;
    const routes = `<g transform="translate(${cx},${cy}) scale(${scale})" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M-250-70H-156Q-134-70-134-48V-20H-78M78 20H134V48Q134 70 156 70H250" stroke="#7DF1CE" stroke-opacity=".6" stroke-width="3"/><path d="M-250 70H-156Q-134 70-134 48V20H-78M78-20H134V-48Q134-70 156-70H250" stroke="#FFD17A" stroke-opacity=".6" stroke-width="3"/><circle cx="-180" cy="-70" r="6" fill="#7DF1CE" stroke="none"/><circle cx="180" cy="70" r="6" fill="#7DF1CE" stroke="none"/><circle cx="-180" cy="70" r="6" fill="#FFD17A" stroke="none"/><circle cx="180" cy="-70" r="6" fill="#FFD17A" stroke="none"/></g>`;
    const bg = Buffer.from(svg(width, height, backdrop(width, height) + routes));
    const mark = await sharp(Buffer.from(logo)).resize(Math.round(216 * scale), Math.round(216 * scale)).png().toBuffer();
    const composed = await sharp(bg).composite([{ input: mark, gravity: 'centre' }]).toBuffer();
    for (const store of ['chrome', 'edge']) await save(composed, `store-assets/${store}/${file}`, width, height, false, 'Text-free brand promotional tile');
  }
}

async function preview(browser) {
  const thumbnails = records.filter(item => item.file.startsWith('store-assets/chrome/') || item.file.startsWith('store-assets/edge/') && (item.file.endsWith('06-validation.png') || item.width === 300));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  try {
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Quick API Client — Store artwork</title><style>body{margin:0;padding:48px;background:#091225;color:#eaf1ff;font:16px 'Segoe UI',Arial,sans-serif}h1{margin:0 0 8px;font-size:38px}p{color:#adc0da;margin:0 0 32px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.card{background:#152440;border:1px solid #30466b;border-radius:12px;padding:14px}img{display:block;width:100%;height:240px;object-fit:contain;background:repeating-conic-gradient(#243555 0% 25%,#1a2943 0% 50%) 0/20px 20px;border-radius:5px}.label{margin-top:12px;font-size:13px;overflow-wrap:anywhere}.sizes{display:flex;align-items:center;gap:24px;margin:28px 0}.sizes img{height:auto;width:auto;max-height:64px;background:none}.note{font-size:13px;margin-top:32px}</style></head><body><h1>Quick API Client</h1><p>Chrome Web Store + Microsoft Edge Add-ons · Updated artwork · ${require('../manifest.json').version}</p><div class="sizes">${[16, 32, 48, 64].map(size => `<img alt="${size}px icon" width="${size}" height="${size}" src="data:image/png;base64,${fs.readFileSync(path.join(root, `icons/icon${size}.png`)).toString('base64')}">`).join('')}<span>Toolbar icons at actual sizes</span></div><div class="grid">${thumbnails.map(item => `<div class="card"><img alt="${escape(item.purpose)}" src="data:image/png;base64,${fs.readFileSync(path.join(root, item.file)).toString('base64')}"><div class="label">${item.file.replace('store-assets/', '')}<br>${item.width} × ${item.height} · ${item.alpha ? 'Transparent' : 'RGB PNG'}</div></div>`).join('')}</div><p class="note">Screenshots use the real application with isolated demonstration fixtures. Upload five to Chrome; up to six to Edge. Promotional artwork is text-free.</p></body></html>`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
    fs.writeFileSync(path.join(out, 'preview.html'), await page.content());
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await save(await page.screenshot({ fullPage: true }), 'store-assets/contact-sheet.png', 1440, height, false, 'Artwork review sheet; do not upload to stores');
  } finally { await page.close(); }
}

async function run() {
  if (process.argv.includes('--check')) {
    const inventory = JSON.parse(fs.readFileSync(path.join(out, 'asset-manifest.json'), 'utf8'));
    for (const item of inventory.assets) {
      const metadata = await sharp(path.join(root, item.file)).metadata();
      for (const field of ['width', 'height', 'channels']) assert.equal(metadata[field], item[field], `${item.file}: ${field}`);
      assert.equal(metadata.hasAlpha, item.alpha, item.file);
      assert.equal(metadata.format, 'png', item.file);
      assert.equal(metadata.depth, 'uchar', item.file);
      assert.equal(fs.statSync(path.join(root, item.file)).size, item.bytes, item.file);
    }
    const storeIcon = await sharp(path.join(root, 'icons/icon128.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let pixels = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const alpha = storeIcon.data[(y * 128 + x) * 4 + 3];
      if (x < 16 || x >= 112 || y < 16 || y >= 112) assert.equal(alpha, 0, '128px icon must have 16px transparent padding');
      if (alpha) pixels++;
    }
    assert.ok(pixels > 6000, 'Icon artwork must be present');
    assert.equal(inventory.assets.filter(item => item.file.includes('/chrome/screenshots/')).length, 5);
    assert.equal(inventory.assets.filter(item => item.file.includes('/edge/screenshots/')).length, 6);
    const manifest = require('../manifest.json');
    for (const [size, relative] of Object.entries({ ...manifest.icons, ...manifest.action.default_icon })) {
      const metadata = await sharp(path.join(root, relative)).metadata();
      assert.equal(metadata.width, Number(size));
      assert.equal(metadata.height, Number(size));
    }
    console.log(`Verified ${inventory.assets.length} PNGs, store screenshot counts, manifest icons, and transparent icon padding.`);
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(path.join(out, 'source'), { recursive: true });
  fs.copyFileSync(path.join(root, 'icons/icon.svg'), path.join(out, 'source/icon.svg'));
  for (const size of sizes) {
    // Small toolbar sizes use less padding to keep the two arrows readable.
    const source = size <= 32 ? logo.replace('viewBox="0 0 128 128"', 'viewBox="10 10 108 108"') : logo;
    await save(Buffer.from(source), `icons/icon${size}.png`, size, size, true, 'Extension icon');
  }
  await save(Buffer.from(logo), 'store-assets/chrome/store-icon-128.png', 128, 128, true, 'Chrome listing icon');
  await save(Buffer.from(logo), 'store-assets/edge/store-logo-300.png', 300, 300, true, 'Edge recommended listing logo');
  await save(Buffer.from(logo), 'store-assets/source/logo-1024.png', 1024, 1024, true, 'High resolution brand master');
  await promotions();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const shot of shots) await capture(browser, shot);
    await preview(browser);
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'asset-manifest.json'), JSON.stringify({ extensionVersion: require('../manifest.json').version, requirementsChecked: '2026-10-06', sources: ['https://developer.chrome.com/docs/webstore/images', 'https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-7-enter-store-listing-details-for-each-language'], assets: records }, null, 2) + '\n');
  console.log(`Generated ${records.length} verified PNGs. Review store-assets/preview.html.`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
