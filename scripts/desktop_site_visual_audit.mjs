import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const root = process.cwd();
const baseURL = process.env.K365_BASE_URL || 'http://127.0.0.1:8790';
const outputDir = process.env.K365_DESKTOP_AUDIT_DIR || '/tmp/k365-desktop-site-audit';
const source = await fs.readFile(path.join(root, 'public/sitemap.xml'), 'utf8');
const routes = [...source.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, value]) => new URL(value).pathname);
routes.push('/404.html');
const widths = [1024, 1440, 1920];
const engines = [
  { name: 'desktop-chromium', type: chromium, fullPage: true },
  { name: 'desktop-webkit', type: webkit, fullPage: false },
];
const settleVisibleImages = page => page.evaluate(async () => {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const visible = [...document.images].filter(image => {
    const rect = image.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth && !image.complete && (image.currentSrc || image.src);
  });
  await Promise.all(visible.map(image => new Promise(resolve => {
    let timer;
    const done = () => { clearTimeout(timer); resolve(); };
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
    timer = setTimeout(done, 5000);
  })));
  await new Promise(resolve => setTimeout(resolve, 100));
});

await fs.mkdir(outputDir, { recursive: true });
const results = { startedAt: new Date().toISOString(), baseURL, routes: routes.length, widths, engines: {} };

for (const engine of engines) {
  const dir = path.join(outputDir, 'screenshots', engine.name);
  await fs.mkdir(dir, { recursive: true });
  const browser = await engine.type.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.setItem('kalendorius365:privacy-notice:v1', 'dismissed'));
  const page = await context.newPage();
  const pageResults = [];
  let failedRequests = [];
  let failedResponses = [];
  let pageErrors = [];
  page.on('requestfailed', request => {
    const error = request.failure()?.errorText || 'request failed';
    if (!/ABORTED|cancelled/i.test(error)) failedRequests.push({ url: request.url(), error });
  });
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() });
  });
  page.on('pageerror', error => pageErrors.push(String(error)));

  for (let index = 0; index < routes.length; index++) {
    const route = routes[index];
    failedRequests = [];
    failedResponses = [];
    pageErrors = [];
    let responseStatus = null;
    let navigationError = null;
    try {
      const response = await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
      responseStatus = response?.status() ?? null;
      await page.evaluate(() => document.fonts?.ready);
      // Visit the full document and wait for each visible lazy-image batch before capturing evidence.
      await page.evaluate(async () => {
        const waitForVisibleImages = async () => {
          const pending = [...document.images].filter(image => {
            const rect = image.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < innerHeight && !image.complete && (image.currentSrc || image.src);
          });
          await Promise.all(pending.map(image => new Promise(resolve => {
            let timer;
            const done = () => { clearTimeout(timer); resolve(); };
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
            timer = setTimeout(done, 2500);
          })));
        };
        const step = Math.max(500, Math.floor(innerHeight * 0.72));
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          scrollTo(0, y);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          await new Promise(resolve => setTimeout(resolve, 100));
          await waitForVisibleImages();
        }
        await new Promise(resolve => setTimeout(resolve, 180));
        scrollTo(0, 0);
      });
      await page.waitForTimeout(100);
    } catch (error) {
      navigationError = String(error);
    }

    const screenshot = !navigationError && responseStatus === 200
      ? path.join(dir, `${String(index + 1).padStart(3, '0')}.png`)
      : null;
    if (screenshot) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: screenshot, fullPage: engine.fullPage, animations: 'disabled', timeout: 30000 });
    }

    const measurements = [];
    if (!navigationError && responseStatus === 200) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await settleVisibleImages(page);
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
          const outside = [...main.querySelectorAll('*')].filter(element => visible(element) && !inHorizontalScroller(element)).map(element => {
            const rect = element.getBoundingClientRect();
            return { tag: element.tagName.toLowerCase(), id: element.id || '', className: typeof element.className === 'string' ? element.className.trim().slice(0, 100) : '', left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
          }).filter(element => element.left < -1 || element.right > innerWidth + 1).slice(0, 16);
          const clippedText = [...main.querySelectorAll('h1,h2,h3,button,a.button,input,select,textarea,[role=button]')].filter(element => {
            if (!visible(element) || element.scrollWidth <= element.clientWidth + 2) return false;
            const style = getComputedStyle(element);
            const visuallyHidden = style.position === 'absolute' && (element.clientWidth <= 1 || element.clientHeight <= 1);
            const intentionalFileInput = element.matches('input[type=file]') && style.clip !== 'auto';
            const actuallyClipped = ['hidden', 'clip'].includes(style.overflowX) || style.clip !== 'auto' || style.clipPath !== 'none';
            return !visuallyHidden && !intentionalFileInput && actuallyClipped;
          }).map(element => ({ tag: element.tagName.toLowerCase(), text: (element.innerText || element.value || '').trim().replace(/\s+/g, ' ').slice(0, 100), id: element.id || '', width: element.clientWidth, scrollWidth: element.scrollWidth })).slice(0, 16);
          const brokenImages = [...document.images].filter(image => image.complete && image.naturalWidth === 0 && image.getAttribute('src')).map(image => image.currentSrc || image.src).slice(0, 20);
          const incompleteImages = [...document.images].filter(image => {
            const rect = image.getBoundingClientRect();
            return !image.complete && image.getAttribute('src') && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
          }).map(image => image.currentSrc || image.src).slice(0, 20);
          const h1 = document.querySelector('main h1, #main h1, h1');
          const mainRect = main.getBoundingClientRect();
          const actionBounds = [...main.querySelectorAll('button,a.button,[role=button]')].filter(visible).slice(0, 40).map(element => {
            const rect = element.getBoundingClientRect();
            return { text: (element.innerText || element.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80), left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) };
          });
          return {
            width: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
            horizontalPageOverflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
            mainLeft: Math.round(mainRect.left), mainRight: Math.round(mainRect.right), mainWidth: Math.round(mainRect.width),
            h1: h1 ? (h1.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120) : null,
            h1Visible: h1 ? visible(h1) : false,
            offscreenElements: outside,
            clippedText,
            brokenImages,
            incompleteImages,
            actions: actionBounds,
          };
        }));
      }
    }
    pageResults.push({ route, status: responseStatus, navigationError, measurements, failedRequests, failedResponses, pageErrors, screenshot });
    if ((index + 1) % 24 === 0 || index + 1 === routes.length) console.log(`${engine.name}: ${index + 1}/${routes.length}`);
  }
  results.engines[engine.name] = pageResults;
  await fs.writeFile(path.join(outputDir, `${engine.name}.json`), JSON.stringify(pageResults, null, 2) + '\n');
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
      if (layout.horizontalPageOverflow || !layout.h1Visible || layout.brokenImages.length || layout.incompleteImages.length || layout.clippedText.length) findings.push({ engine, route: page.route, kind: 'layout', width: layout.width, horizontalPageOverflow: layout.horizontalPageOverflow, h1Visible: layout.h1Visible, brokenImages: layout.brokenImages, incompleteImages: layout.incompleteImages, clippedText: layout.clippedText, offscreenElements: layout.offscreenElements });
    }
  }
}
await fs.writeFile(path.join(outputDir, 'findings.json'), JSON.stringify(findings, null, 2) + '\n');
console.log(JSON.stringify({ routes: routes.length, engines: Object.keys(results.engines), measurements: Object.values(results.engines).reduce((sum, list) => sum + list.reduce((n, page) => n + page.measurements.length, 0), 0), findings: findings.length, outputDir }, null, 2));
