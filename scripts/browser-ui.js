/* Real extension UI regressions. Screenshots are saved for visual review. */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

module.exports = async function checkUI(page, context, id, base) {
  const screenshots = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(screenshots, { recursive: true });
  const popup = `chrome-extension://${id}/popup.html`;

  async function assertLayout() {
    const layout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const workspace = rect('.workspace');
      const footer = rect('.footer-actions');
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        footerVisible: footer.bottom <= innerHeight + 1,
        covered: workspace.bottom > footer.top + 1,
        toolbarClipped: Array.from(document.querySelectorAll('.actions > *')).filter(element =>
          element.getClientRects().length && (element.scrollWidth > element.clientWidth + 1 || element.getBoundingClientRect().right > innerWidth)).map(element => element.textContent),
      };
    });
    assert.equal(layout.overflow, false, 'Page must not scroll horizontally');
    assert.equal(layout.footerVisible, true, 'Send must remain visible');
    assert.equal(layout.covered, false, 'Send bar must not cover the response');
    assert.deepEqual(layout.toolbarClipped, [], 'Every toolbar label must fit');
  }

  await page.setViewportSize({ width: 1560, height: 950 });
  await page.locator('#url').fill(base + '/echo');
  await page.locator('#method').selectOption('POST');
  await page.locator('#body').fill('{"name":"Ada"}');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(() => document.getElementById('statusBadge').textContent.startsWith('200'));
  await assertLayout();
  const columns = await page.evaluate(() => {
    const request = document.querySelector('.request').getBoundingClientRect();
    const response = document.querySelector('.response').getBoundingClientRect();
    return response.left >= request.right && response.width > innerWidth * 0.35;
  });
  assert.equal(columns, true, 'Wide tabs show request and response side by side');
  assert.ok((await page.locator('#requestPreview').textContent()).includes('{"name":"Ada"}'), 'Send refreshes the preview immediately');
  await page.evaluate(() => { document.querySelector('.workspace').scrollTop = 0; });
  await page.evaluate(() => { window.applyTheme('dark'); });
  await page.screenshot({ path: path.join(screenshots, 'desktop-dark.png'), animations: 'disabled' });
  await page.evaluate(() => { window.applyTheme('light'); });
  await page.screenshot({ path: path.join(screenshots, 'desktop-light.png'), animations: 'disabled' });

  await page.locator('#saveFavoriteBtn').click();
  await page.locator('#favoriteName').fill('UI regression');
  await page.locator('#confirmSaveFavoriteBtn').click();
  await page.waitForFunction(() => !document.getElementById('saveFavoriteModal').classList.contains('show'));
  assert.equal(await page.locator('#loadFavoriteBtn').isEnabled(), true);
  await page.locator('#url').fill(base + '/different');
  await page.locator('#loadFavoriteBtn').click();
  assert.equal(await page.locator('#url').inputValue(), base + '/echo');
  await page.locator('#deleteFavoriteBtn').click();
  assert.equal(await page.locator('#confirmModalCancelBtn').evaluate(element => element === document.activeElement), true);
  await page.locator('#confirmModalCancelBtn').click();
  assert.equal(await page.locator('#deleteFavoriteBtn').evaluate(element => element === document.activeElement), true);

  await page.locator('#shareBtn').click();
  const exported = await page.locator('#shareExportOutput').inputValue();
  await page.locator('#shareImportInput').fill(exported);
  await page.locator('#shareImportApplyBtn').click();
  assert.equal(await page.locator('#url').inputValue(), base + '/echo');

  const compact = await context.newPage();
  const errors = [];
  compact.on('pageerror', error => errors.push(error.message));
  await compact.setViewportSize({ width: 780, height: 600 });
  await compact.goto(popup);
  await compact.waitForFunction(() => document.getElementById('url').value !== '');
  assert.equal(await compact.locator('body').getAttribute('data-view'), 'popup');
  const compactGeometry = await compact.evaluate(() => ({
    width: document.body.getBoundingClientRect().width,
    footer: document.querySelector('.footer-actions').getBoundingClientRect().bottom,
  }));
  assert.equal(compactGeometry.width, 780);
  assert.ok(compactGeometry.footer <= 600);
  await compact.screenshot({ path: path.join(screenshots, 'popup.png'), animations: 'disabled' });
  // Opening a full tab flushes edits immediately, including with popup restoration disabled.
  await compact.evaluate(() => new Promise(resolve => chrome.storage.sync.get('options', ({ options }) =>
    chrome.storage.sync.set({ options: { ...options, restoreLast: false } }, resolve))));
  await compact.locator('#url').fill(base + '/draft');
  await compact.locator('#body').fill('latest draft');
  const openedPromise = context.waitForEvent('page');
  await compact.locator('#openTabLink').click();
  const opened = await openedPromise;
  await opened.waitForLoadState();
  await opened.waitForFunction(() => document.getElementById('url').value.endsWith('/draft'));
  assert.equal(await opened.locator('#body').inputValue(), 'latest draft');
  await opened.close();

  await compact.locator('#url').fill(base + '/echo');
  await compact.locator('#body').fill('{"popup":true}');
  await compact.locator('#sendBtnBottom').click();
  await compact.waitForFunction(() => document.getElementById('statusBadge').textContent.startsWith('200'));
  assert.equal(await compact.locator('#statusBadge').isVisible(), true, 'Compact requests reveal the response after sending');
  const downloadPromise = compact.waitForEvent('download');
  await compact.locator('#saveBodyBtn').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'response.json');
  assert.equal(fs.readFileSync(await download.path(), 'utf8'), await compact.locator('#responseBody').getAttribute('data-raw'));
  await compact.close();

  for (const width of [900, 780, 540, 390, 320]) {
    await page.setViewportSize({ width, height: 680 });
    await assertLayout();
  }
  await page.screenshot({ path: path.join(screenshots, 'narrow-tab.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 320, height: 360 });
  await page.locator('#shareBtn').click();
  await page.locator('#closeShareModalFooter').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#closeShareModal').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('#closeShareModalFooter').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Control+k');
  assert.equal(await page.locator('#shareModal').evaluate(element => element.contains(document.activeElement)), true);
  const dialogBounds = await page.locator('#shareModal .modal-content').boundingBox();
  assert.ok(dialogBounds.y >= 0 && dialogBounds.y + dialogBounds.height <= 360);
  await page.screenshot({ path: path.join(screenshots, 'short-dialog.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#shareBtn').evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('main').evaluate(element => element.inert), false);

  // Validation errors clear the old HTTP body and disable stale response actions.
  await page.setViewportSize({ width: 1560, height: 950 });
  await page.locator('#url').fill('ftp://invalid');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(() => document.getElementById('statusBadge').textContent === 'Client Error');
  assert.equal(await page.locator('#copyBodyBtn').isEnabled(), false);
  assert.equal(await page.locator('#responseBody').getAttribute('data-raw'), null);
  await page.locator('#clearBtn').click();
  assert.equal(await page.locator('#responseEmpty').isVisible(), true);

  const options = await context.newPage();
  options.on('pageerror', error => errors.push(error.message));
  await options.setViewportSize({ width: 390, height: 740 });
  await options.goto(`chrome-extension://${id}/options.html`);
  await options.waitForFunction(() => document.getElementById('defaultUrl').value !== '');
  assert.equal(await options.locator('#restoreLast').evaluate(element => getComputedStyle(element).appearance), 'auto');
  assert.equal(await options.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await options.locator('#defaultHeaders').fill('[{"key":');
  await options.locator('#saveBtn').click();
  assert.match(await options.locator('#status').textContent(), /valid JSON/);
  assert.equal(await options.locator('#status').isVisible(), true);
  await options.screenshot({ path: path.join(screenshots, 'settings-narrow.png'), animations: 'disabled' });
  await options.close();
  assert.deepEqual(errors, []);
};
