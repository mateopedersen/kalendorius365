import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';

const root = process.cwd();
const baseURL = process.env.K365_BASE_URL || 'http://127.0.0.1:8790';
const outputDir = process.env.K365_MOBILE_AUDIT_DIR || '/tmp/k365-mobile-site-audit';
const source = await fs.readFile(path.join(root, 'public/sitemap.xml'), 'utf8');
const routes = [...source.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, value]) => new URL(value).pathname);
routes.push('/404.html');
const widths = [320, 390, 430];
const engines = [
  { name: 'android-chromium', type: chromium, device: devices['Pixel 5'] },
  { name: 'iphone-webkit', type: webkit, device: devices['iPhone 13'] },
];

await fs.mkdir(outputDir, { recursive: true });
const results = { startedAt: new Date().toISOString(), baseURL, routes: routes.length, widths, engines: {} };

for (const engine of engines) {
  const dir = path.join(outputDir, engine.name);
  await fs.mkdir(dir, { recursive: true });
  const browser = await engine.type.launch({ headless: true });
  const context = await browser.newContext({ ...engine.device, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.setItem('kalendorius365:privacy-notice:v1', 'dismissed'));
  const page = await context.newPage();
  const engineResults = [];
  let failedRequests = [];
  let failedResponses = [];
  let environmentUnavailable = [];
  let pageErrors = [];
  page.on('requestfailed', request => {
    const error = request.failure()?.errorText || 'request failed';
    if (!/ABORTED/i.test(error)) failedRequests.push({ url: request.url(), error });
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      const url = new URL(response.url());
      if (['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/api/')) {
        environmentUnavailable.push({ url: response.url(), status: response.status(), reason: 'local static server does not emulate Cloudflare Pages Functions' });
      } else failedResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('pageerror', error => pageErrors.push(String(error)));

  for (let index = 0; index < routes.length; index++) {
    const route = routes[index];
    failedRequests = [];
    failedResponses = [];
    environmentUnavailable = [];
    pageErrors = [];
    let responseStatus = null;
    let navigationError = null;
    try {
      const response = await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      responseStatus = response?.status() ?? null;
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(80);
    } catch (error) {
      navigationError = String(error);
    }

    let screenshot = null;
    if (!navigationError && responseStatus === 200) {
      screenshot = path.join(dir, `${String(index + 1).padStart(3, '0')}.png`);
      await page.screenshot({ path: screenshot, animations: 'disabled' });
    }

    const measurements = [];
    if (!navigationError && responseStatus === 200) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(40);
        measurements.push(await page.evaluate(() => {
          const visible = element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
          };
          const main = document.querySelector('main') || document.body;
          const inHorizontalScroller = element => {
            for (let parent = element.parentElement; parent && parent !== main; parent = parent.parentElement) {
              const style = getComputedStyle(parent);
              if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
            }
            return false;
          };
          const overflowing = [...main.querySelectorAll('*')].filter(element => visible(element) && !inHorizontalScroller(element)).map(element => {
            const rect = element.getBoundingClientRect();
            return { tag: element.tagName.toLowerCase(), id: element.id || '', className: typeof element.className === 'string' ? element.className.trim().slice(0, 90) : '', left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
          }).filter(element => element.left < -1 || element.right > innerWidth + 1).slice(0, 12);
          const clippedText = [...main.querySelectorAll('h1,h2,h3,button,a.button,input,select,textarea')].filter(element => {
            if (!visible(element) || element.scrollWidth <= element.clientWidth + 2) return false;
            const style = getComputedStyle(element);
            const visuallyHidden = style.position === 'absolute' && (element.clientWidth <= 1 || element.clientHeight <= 1);
            const intentionalFileInput = element.matches('input[type="file"]') && style.clip !== 'auto';
            const actuallyClipped = ['hidden', 'clip'].includes(style.overflowX) || style.clip !== 'auto' || style.clipPath !== 'none';
            return !visuallyHidden && !intentionalFileInput && actuallyClipped;
          }).map(element => ({ tag: element.tagName.toLowerCase(), text: (element.innerText || element.value || '').trim().replace(/\s+/g, ' ').slice(0, 100), id: element.id || '', width: element.clientWidth, scrollWidth: element.scrollWidth })).slice(0, 12);
          const visibleImages = [...document.images].filter(image => visible(image) && image.getBoundingClientRect().top < innerHeight && image.getBoundingClientRect().bottom > 0);
          const brokenImages = visibleImages.filter(image => image.complete && image.naturalWidth === 0).map(image => image.currentSrc || image.src);
          const h1 = document.querySelector('main h1, #main h1, h1');
          const mainRect = main.getBoundingClientRect();
          return {
            width: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            horizontalPageOverflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
            mainLeft: Math.round(mainRect.left),
            mainRight: Math.round(mainRect.right),
            mainWidth: Math.round(mainRect.width),
            h1: h1 ? (h1.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120) : null,
            h1Visible: h1 ? visible(h1) : false,
            offscreenElements: overflowing,
            clippedText,
            brokenVisibleImages: brokenImages,
          };
        }));
      }
    }

    engineResults.push({ route, status: responseStatus, navigationError, measurements, failedRequests, failedResponses, environmentUnavailable, pageErrors, screenshot });
    if ((index + 1) % 24 === 0 || index + 1 === routes.length) console.log(`${engine.name}: ${index + 1}/${routes.length}`);
  }

  results.engines[engine.name] = engineResults;
  await fs.writeFile(path.join(outputDir, `${engine.name}.json`), JSON.stringify(engineResults, null, 2) + '\n');
  await context.close();
  await browser.close();
}

results.finishedAt = new Date().toISOString();
await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2) + '\n');
const findings = [];
for (const [engine, pages] of Object.entries(results.engines)) {
  for (const page of pages) {
    if (page.status !== 200 || page.navigationError || page.failedRequests.length || page.failedResponses.length || page.pageErrors.length) findings.push({ engine, route: page.route, kind: 'runtime', status: page.status, navigationError: page.navigationError, failedRequests: page.failedRequests, failedResponses: page.failedResponses, pageErrors: page.pageErrors });
    for (const layout of page.measurements) {
      if (layout.horizontalPageOverflow || !layout.h1Visible || layout.brokenVisibleImages.length) findings.push({ engine, route: page.route, kind: 'layout', ...layout });
    }
  }
}
await fs.writeFile(path.join(outputDir, 'findings.json'), JSON.stringify(findings, null, 2) + '\n');
console.log(JSON.stringify({ routes: routes.length, engines: Object.keys(results.engines), measurements: Object.values(results.engines).reduce((sum, list) => sum + list.reduce((n, page) => n + page.measurements.length, 0), 0), findings: findings.length, outputDir }, null, 2));
