/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
test('release includes every script, stylesheet and declared entry point', () => {
  const script = fs.readFileSync(path.join(root, 'release.sh'), 'utf8');
  const included = script.match(/INCLUDE_FILES=\(([\s\S]*?)\)/)[1].trim().split(/\s+/);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  const resources = ['manifest.json', manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...Object.values(manifest.icons)];
  for (const file of ['popup.html', 'options.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)) resources.push(match[1]);
  }
  for (const resource of resources) {
    expect(fs.existsSync(path.join(root, resource))).toBe(true);
    expect(included.some(entry => entry === resource || entry.endsWith('/') && resource.startsWith(entry))).toBe(true);
  }
});
test('package and manifest version metadata agree', () => {
  const manifest = require('../manifest.json');
  expect(require('../package.json').version).toBe(manifest.version);
  expect(require('../package-lock.json').version).toBe(manifest.version);
  expect(require('../package-lock.json').packages[''].version).toBe(manifest.version);
});
