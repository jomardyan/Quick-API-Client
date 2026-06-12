const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIST_DIR = path.join(__dirname, "store-assets");
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR);
}

// Read icon base64
const iconPath = path.join(__dirname, "icons", "icon128.png");
let iconBase64 = "";
if (fs.existsSync(iconPath)) {
  iconBase64 = fs.readFileSync(iconPath).toString("base64");
}

async function run() {
  console.log("Launching Playwright chromium...");
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  // Mock chrome API script
  const initScript = `
    window.chrome = {
      runtime: {
        sendMessage: (msg, callback) => {
          if (msg?.type === "api-request") {
            setTimeout(() => {
              callback({
                ok: true,
                status: 200,
                statusText: "OK",
                headers: [
                  ["content-type", "application/json; charset=utf-8"],
                  ["cache-control", "max-age=43200"],
                  ["x-powered-by", "Express"]
                ],
                elapsed: 142,
                body: JSON.stringify({
                  status: "success",
                  message: "API Request completed successfully!",
                  timestamp: "2026-06-12T12:25:12Z",
                  data: {
                    user: "Hayk Jomardyan",
                    role: "Admin",
                    verified: true,
                    permissions: ["read", "write", "execute"]
                  }
                }, null, 2)
              });
            }, 100);
            return true;
          }
          if (callback) callback();
        },
        lastError: null,
      },
      permissions: {
        contains: (q, cb) => cb(true),
        request: (q, cb) => cb(true)
      },
      storage: {
        local: {
          get: (keys, cb) => {
            const defaults = {
              history: [
                { id: 1, method: "GET", url: "https://api.example.com/users", status: 200, time: 45 },
                { id: 2, method: "POST", url: "https://api.example.com/posts", status: 201, time: 110 }
              ],
              lastRequest: {
                method: "GET",
                url: "https://jsonplaceholder.typicode.com/posts/1",
                headers: [{ key: "Accept", value: "application/json" }],
                query: [{ key: "id", value: "1" }],
                body: ""
              }
            };
            const result = {};
            if (typeof keys === "string") result[keys] = defaults[keys];
            else if (Array.isArray(keys)) keys.forEach(k => result[k] = defaults[k]);
            else Object.assign(result, defaults);
            cb(result);
          },
          set: (d, cb) => cb && cb()
        },
        sync: {
          get: (keys, cb) => {
            const defaults = {
              options: {
                theme: "system",
                defaultUrl: "https://jsonplaceholder.typicode.com/posts/1",
                timeoutSeconds: 15,
                historySize: 8,
                restoreLast: true,
                historyEnabled: true
              },
              environments: [
                { name: "Production", vars: [{ key: "base_url", value: "https://api.example.com" }] },
                { name: "Staging", vars: [{ key: "base_url", value: "https://staging.api.example.com" }] }
              ]
            };
            const result = {};
            if (typeof keys === "string") result[keys] = defaults[keys];
            else if (Array.isArray(keys)) keys.forEach(k => result[k] = defaults[k]);
            else Object.assign(result, defaults);
            cb(result);
          },
          set: (d, cb) => cb && cb()
        },
        onChanged: {
          addListener: () => {},
          removeListener: () => {}
        }
      }
    };
  `;

  // 1. Screenshot Global 1: GET request, dark theme
  {
    console.log("Generating global-1.png...");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(initScript);
    await page.goto(`file://${path.join(__dirname, "popup.html")}`);
    
    // Inject custom centering styles
    await page.addStyleTag({
      content: `
        body {
          margin: 0;
          padding: 0;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 1280px !important;
          height: 800px !important;
          background: linear-gradient(135deg, #0f172a, #1e1b4b) !important;
        }
        .shell {
          width: 780px !important;
          height: 720px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5) !important;
          background: var(--md-sys-color-background) !important;
          overflow: hidden !important;
        }
      `
    });

    // Interact with UI
    await page.fill("#url", "https://jsonplaceholder.typicode.com/posts/1");
    await page.click("#sendBtn");
    await page.waitForTimeout(200); // Wait for mock fetch response

    await page.screenshot({ path: path.join(DIST_DIR, "global-1.png"), type: "png" });
    await context.close();
  }

  // 2. Screenshot Global 2: POST request, light theme
  {
    console.log("Generating global-2.png...");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(initScript);
    await page.goto(`file://${path.join(__dirname, "popup.html")}`);

    // Set light theme
    await page.evaluate(() => {
      document.body.setAttribute("data-theme", "light");
    });

    await page.addStyleTag({
      content: `
        body {
          margin: 0;
          padding: 0;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 1280px !important;
          height: 800px !important;
          background: linear-gradient(135deg, #f1f5f9, #cbd5e1) !important;
        }
        .shell {
          width: 780px !important;
          height: 720px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1) !important;
          background: var(--md-sys-color-background) !important;
          overflow: hidden !important;
        }
      `
    });

    // Interact with UI: Set method to POST, body to custom JSON
    await page.selectOption("#method", "POST");
    await page.fill("#url", "https://httpbin.org/post");
    await page.fill("#body", JSON.stringify({ title: "foo", body: "bar", userId: 1 }, null, 2));
    await page.click("#sendBtn");
    await page.waitForTimeout(200);

    await page.screenshot({ path: path.join(DIST_DIR, "global-2.png"), type: "png" });
    await context.close();
  }

  // 3. Screenshot Global 3: Options page, beautiful dark theme
  {
    console.log("Generating global-3.png...");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(initScript);
    await page.goto(`file://${path.join(__dirname, "options.html")}`);

    await page.addStyleTag({
      content: `
        body {
          margin: 0;
          padding: 0;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 1280px !important;
          height: 800px !important;
          background: linear-gradient(135deg, #0f172a, #0369a1) !important;
        }
        .shell {
          width: 840px !important;
          height: 720px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5) !important;
          background: var(--md-sys-color-background) !important;
          overflow-y: auto !important;
          padding: 24px !important;
        }
      `
    });

    await page.screenshot({ path: path.join(DIST_DIR, "global-3.png"), type: "png" });
    await context.close();
  }

  // 4. Screenshot Global 4: Popup Code snippets modal open
  {
    console.log("Generating global-4.png...");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(initScript);
    await page.goto(`file://${path.join(__dirname, "popup.html")}`);

    await page.addStyleTag({
      content: `
        body {
          margin: 0;
          padding: 0;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 1280px !important;
          height: 800px !important;
          background: linear-gradient(135deg, #1e1b4b, #581c87) !important;
        }
        .shell {
          width: 780px !important;
          height: 720px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5) !important;
          background: var(--md-sys-color-background) !important;
          overflow: hidden !important;
        }
      `
    });

    // Open snippets modal
    await page.click("#codegenBtn");
    await page.waitForTimeout(100);

    await page.screenshot({ path: path.join(DIST_DIR, "global-4.png"), type: "png" });
    await context.close();
  }

  // 5. Screenshot Global 5: Response validation modal open
  {
    console.log("Generating global-5.png...");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(initScript);
    await page.goto(`file://${path.join(__dirname, "popup.html")}`);

    await page.addStyleTag({
      content: `
        body {
          margin: 0;
          padding: 0;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 1280px !important;
          height: 800px !important;
          background: linear-gradient(135deg, #0f172a, #115e59) !important;
        }
        .shell {
          width: 780px !important;
          height: 720px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5) !important;
          background: var(--md-sys-color-background) !important;
          overflow: hidden !important;
        }
      `
    });

    await page.click("#sendBtn");
    await page.waitForTimeout(200);
    await page.click("#validateBtn");
    await page.waitForTimeout(100);

    await page.screenshot({ path: path.join(DIST_DIR, "global-5.png"), type: "png" });
    await context.close();
  }

  // 6. Screenshot Localized 1: GraphQL variables view
  {
    console.log("Generating localized-1.png...");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(initScript);
    await page.goto(`file://${path.join(__dirname, "popup.html")}`);

    await page.addStyleTag({
      content: `
        body {
          margin: 0;
          padding: 0;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 1280px !important;
          height: 800px !important;
          background: linear-gradient(135deg, #18181b, #78350f) !important;
        }
        .shell {
          width: 780px !important;
          height: 720px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5) !important;
          background: var(--md-sys-color-background) !important;
          overflow: hidden !important;
        }
      `
    });

    // Toggle GraphQL and fill query
    await page.click("#gqlToggleBtn");
    await page.fill("#body", "query GetUser($id: ID!) {\n  user(id: $id) {\n    name\n    email\n  }\n}");
    await page.fill("#gqlVariables", "{\n  \"id\": \"42\"\n}");

    await page.screenshot({ path: path.join(DIST_DIR, "localized-1.png"), type: "png" });
    await context.close();
  }

  // 7. Screenshot Localized 2: Auth modal open
  {
    console.log("Generating localized-2.png...");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(initScript);
    await page.goto(`file://${path.join(__dirname, "popup.html")}`);

    await page.addStyleTag({
      content: `
        body {
          margin: 0;
          padding: 0;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 1280px !important;
          height: 800px !important;
          background: linear-gradient(135deg, #1e293b, #3b82f6) !important;
        }
        .shell {
          width: 780px !important;
          height: 720px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5) !important;
          background: var(--md-sys-color-background) !important;
          overflow: hidden !important;
        }
      `
    });

    // Click Auth button
    await page.click("#authTemplateBtn");
    await page.waitForTimeout(100);

    await page.screenshot({ path: path.join(DIST_DIR, "localized-2.png"), type: "png" });
    await context.close();
  }

  // 8. Screenshot Small Promo Tile: 440x280
  {
    console.log("Generating promo-small.png...");
    const context = await browser.newContext({ viewport: { width: 440, height: 280 } });
    const page = await context.newPage();
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            width: 440px;
            height: 280px;
            background: linear-gradient(135deg, #1e3a8a, #4f46e5);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            text-align: center;
            overflow: hidden;
          }
          .card {
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            gap: 16px;
          }
          img {
            width: 64px;
            height: 64px;
          }
          h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.025em;
            color: #ffffff;
          }
          p {
            margin: 4px 0 0 0;
            font-size: 14px;
            color: #cae8ff;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <img src="data:image/png;base64,${iconBase64}" alt="Quick API Client Icon" />
          <div style="text-align: left;">
            <h1>Quick API Client</h1>
            <p>Test REST & GraphQL APIs Instantly</p>
          </div>
        </div>
      </body>
      </html>
    `);

    await page.screenshot({ path: path.join(DIST_DIR, "promo-small.png"), type: "png" });
    await context.close();
  }

  // 9. Screenshot Marquee Promo Tile: 1400x560
  {
    console.log("Generating promo-marquee.png...");
    const context = await browser.newContext({ viewport: { width: 1400, height: 560 } });
    const page = await context.newPage();
    
    // We render a beautiful split view marquee card
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            width: 1400px;
            height: 560px;
            background: linear-gradient(135deg, #0f172a, #1e1b4b);
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            overflow: hidden;
            padding: 0 80px;
            box-sizing: border-box;
          }
          .left {
            max-width: 540px;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 24px;
          }
          .logo-container img {
            width: 84px;
            height: 84px;
          }
          h1 {
            margin: 0;
            font-size: 52px;
            font-weight: 800;
            letter-spacing: -0.025em;
            background: linear-gradient(to right, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p.tagline {
            margin: 10px 0 32px;
            font-size: 22px;
            color: #94a3b8;
            line-height: 1.4;
          }
          .features {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .feature {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 18px;
            color: #cbd5e1;
          }
          .feature::before {
            content: "✓";
            color: #38bdf8;
            font-weight: bold;
            font-size: 20px;
          }
          .right-mockup {
            width: 620px;
            height: 480px;
            background: #161b22;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .mockup-header {
            background: #21262d;
            height: 44px;
            border-bottom: 1px solid #3d444d;
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 8px;
          }
          .mockup-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #f85149;
          }
          .mockup-dot.yellow { background: #d29922; }
          .mockup-dot.green { background: #3fb950; }
          .mockup-content {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .mockup-api-box {
            width: 100%;
            background: #0d1117;
            border: 1px solid #3d444d;
            border-radius: 8px;
            padding: 16px;
            box-sizing: border-box;
          }
          .mockup-method-url {
            display: flex;
            gap: 10px;
            margin-bottom: 12px;
          }
          .mockup-badge {
            background: #1c3a5e;
            color: #58a6ff;
            font-weight: bold;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 14px;
          }
          .mockup-url-text {
            color: #8b949e;
            font-size: 14px;
            font-family: monospace;
          }
          .mockup-code {
            background: #161b22;
            padding: 12px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 13px;
            color: #79c0ff;
          }
        </style>
      </head>
      <body>
        <div class="left">
          <div class="logo-container">
            <img src="data:image/png;base64,${iconBase64}" alt="Quick API Client Icon" />
            <h1>Quick API Client</h1>
          </div>
          <p class="tagline">Compose, test, and debug HTTP requests smoothly directly from your browser extension.</p>
          <div class="features">
            <div class="feature">REST & GraphQL Custom Editors</div>
            <div class="feature">Fast cURL Snippet Generation</div>
            <div class="feature">Material Design 3 Design System</div>
            <div class="feature">Dynamic Environment Scoping</div>
          </div>
        </div>
        <div class="right-mockup">
          <div class="mockup-header">
            <div class="mockup-dot"></div>
            <div class="mockup-dot yellow"></div>
            <div class="mockup-dot green"></div>
            <div style="color: #8b949e; font-size: 13px; margin-left: 12px;">Quick API Client Extension</div>
          </div>
          <div class="mockup-content">
            <div class="mockup-api-box">
              <div class="mockup-method-url">
                <span class="mockup-badge">GET</span>
                <span class="mockup-url-text">https://api.example.com/v1/users?limit=10</span>
              </div>
              <div class="mockup-code" style="color: #7ee787;">
                {
                  "status": "success",
                  "data": [
                    { "id": 1, "name": "Hayk Jomardyan" },
                    { "id": 2, "name": "Admin" }
                  ]
                }
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);

    await page.screenshot({ path: path.join(DIST_DIR, "promo-marquee.png"), type: "png" });
    await context.close();
  }

  console.log("All screenshots generated successfully!");
  await browser.close();
}

run().catch((err) => {
  console.error("Error generating screenshots:", err);
  process.exit(1);
});
