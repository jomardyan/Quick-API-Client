/* Opens the browser-action surface itself, with Chrome's automatic popup sizing. */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

module.exports = async function checkToolbar(context, worker, id) {
  const session = await context.newCDPSession(context.pages()[0]);
  let targetId;
  try {
    await worker.evaluate(() => chrome.action.openPopup());
    const { targetInfos } = await session.send('Target.getTargets');
    const target = targetInfos.find(info => info.url === `chrome-extension://${id}/popup.html`);
    assert.ok(target, 'The browser action must open its popup');
    targetId = target.targetId;
    // Playwright does not expose toolbar popup targets as ordinary pages.
    const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: false });
    let sequence = 0;
    const call = (method, params) => {
      return new Promise((resolve, reject) => {
        const commandId = ++sequence;
        const cleanup = () => {
          clearTimeout(timeout);
          session.off('Target.receivedMessageFromTarget', onMessage);
        };
        const onMessage = event => {
          if (event.sessionId !== sessionId) return;
          const response = JSON.parse(event.message);
          if (response.id !== commandId) return;
          cleanup();
          if (response.error) reject(new Error(response.error.message));
          else resolve(response.result);
        };
        const timeout = setTimeout(() => { cleanup(); reject(new Error(`Toolbar command timed out: ${method}`)); }, 5000);
        session.on('Target.receivedMessageFromTarget', onMessage);
        session.send('Target.sendMessageToTarget', {
          sessionId, message: JSON.stringify({ id: commandId, method, params }),
        }).catch(error => { cleanup(); reject(error); });
      });
    };

    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    const result = await call('Runtime.evaluate', {
      expression: `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
        const workspace = document.querySelector('.workspace').getBoundingClientRect();
        const footer = document.querySelector('.footer-actions').getBoundingClientRect();
        const url = document.getElementById('url').getBoundingClientRect();
        resolve({
          width: innerWidth, height: innerHeight, view: document.body.dataset.view, theme: document.body.dataset.theme,
          workspaceHeight: workspace.height, workspaceRight: workspace.right,
          footerBottom: footer.bottom, editorVisible: url.top >= workspace.top && url.bottom <= workspace.bottom,
          clippedActions: Array.from(document.querySelectorAll('.actions > *')).filter(element =>
            element.getClientRects().length && (element.scrollWidth > element.clientWidth + 1 || element.getBoundingClientRect().right > innerWidth)).map(element => element.textContent),
        });
      })))`,
      awaitPromise: true, returnByValue: true,
    });
    assert.equal(result.exceptionDetails, undefined);
    const layout = result.result.value;
    assert.equal(layout.view, 'popup');
    assert.equal(layout.theme, 'light', 'Popup defaults to light regardless of system appearance');
    assert.ok(layout.width >= 700 && layout.width <= 800, `Toolbar popup width collapsed: ${layout.width}px`);
    assert.ok(layout.workspaceHeight >= 250, `Editor has too little space: ${layout.workspaceHeight}px`);
    assert.ok(layout.workspaceRight <= layout.width, 'Editor must fit the available popup width');
    assert.ok(layout.footerBottom <= layout.height, 'Send must fit even when Chrome limits popup height');
    assert.equal(layout.editorVisible, true, 'The request URL must be visible when the icon opens the popup');
    assert.deepEqual(layout.clippedActions, []);

    const screenshots = path.resolve(__dirname, '../test-results');
    fs.mkdirSync(screenshots, { recursive: true });
    for (const theme of ['dark', 'light']) {
      const changed = await call('Runtime.evaluate', {
        expression: `new Promise(resolve => {
          const onChange = (changes, area) => {
            if (area === 'sync' && changes.options?.newValue?.theme === '${theme}') {
              chrome.storage.onChanged.removeListener(onChange);
              resolve(document.body.dataset.theme);
            }
          };
          chrome.storage.onChanged.addListener(onChange);
          document.getElementById('themeBtn').click();
        })`,
        awaitPromise: true, returnByValue: true,
      });
      assert.equal(changed.result.value, theme, 'Theme toggle switches and saves only light/dark');
      const screenshot = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshots, `toolbar-popup-${theme}.png`), Buffer.from(screenshot.data, 'base64'));
    }
    console.log(`Actual browser-action popup passed: ${layout.width} × ${layout.height}, editor ${Math.round(layout.workspaceHeight)}px high`);
  } finally {
    if (targetId) await session.send('Target.closeTarget', { targetId });
    await session.detach();
  }
};
