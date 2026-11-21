import {test,expect} from '@playwright/test';

test('analytics refusal persists without advertising and preserves other stored data',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('qa-unrelated-preference','keep'));
 await page.goto('/2028/');const banner=page.locator('#cookie-notice');await expect(banner).toBeVisible();
 await expect(page.locator('[data-advertising-stage],[data-cookie-advertising],[data-cookie-age]')).toHaveCount(0);await banner.locator('[data-analytics-choice="no"]').click();await expect(banner).toBeHidden();
 await page.reload();await expect(banner).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem('qa-unrelated-preference'))).toBe('keep');
 const choice=await page.evaluate(()=>{return JSON.parse(localStorage.getItem('kalendorius365:analytics-consent:v1'));});
 expect(choice.version).toBe(1);expect(choice.analytics).toBe(false);expect(choice.expiresAt).toBeGreaterThan(Date.now());
 await expect(page.locator('[data-advertising-stage],script[src*="bauval.org"],script[src*="asiafilm.org"]')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('kalendorius365:advertising-consent:v1'))).toBeNull();
});

test('calendar ICS import opens the file chooser and malformed follow-up preserves the imported event',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
 await page.goto('/?data=2028-02-29');
 await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');
 const content=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT','UID:qa-disposable-leap-day','DTSTART;VALUE=DATE:20280229','DTEND;VALUE=DATE:20280301','SUMMARY:QA imported leap day','END:VEVENT','END:VCALENDAR',''].join('\r\n');
 const pending=page.waitForEvent('filechooser');await page.locator('#import-ics').click();
 await (await pending).setFiles({name:'qa.ics',mimeType:'text/calendar',buffer:Buffer.from(content)});
 await expect(page.locator('#day-agenda')).toContainText('QA imported leap day');
 await page.locator('#ics-file').setInputFiles({name:'invalid.ics',mimeType:'text/calendar',buffer:Buffer.from('not a calendar')});
 await expect(page.locator('#day-agenda')).toContainText('QA imported leap day');await page.reload();
 await expect(page.locator('#day-agenda')).toContainText('QA imported leap day');
});

test('print control invokes the browser print action and the main content renders in print media',async({page,context})=>{
 await context.addInitScript(()=>{localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed');window.print=()=>{window.__qaPrintCalls=(window.__qaPrintCalls||0)+1;};});
 await page.goto('/?data=2028-02-29');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await page.locator('.calendar-panel [data-print]').click();
 await page.locator('.right-column [data-print]').click();
 expect(await page.evaluate(()=>window.__qaPrintCalls)).toBe(2);
 await page.emulateMedia({media:'print'});await expect(page.locator('#main')).toBeVisible();await expect(page.locator('#calendar')).toBeVisible();await expect(page.locator('#period-title')).toContainText('2028');
});

test('404 template is excluded from indexing and its home link recovers navigation',async({page})=>{
 const missing=await page.goto('/qa-authorized-nonexistent-page-20261018/');expect(missing.status()).toBe(404);
 await page.goto('/404.html');await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
 await expect(page.locator('#main h1')).toContainText('Puslapis nerastas');
 await page.locator('#main a[href="/"]').first().click();await expect(page).toHaveURL(/\/$/);await expect(page.locator('#main h1')).toBeVisible();
});

test('weather city and clock preferences survive reload without changing the saved note',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:analytics-consent:v1',JSON.stringify({
  version:1,analytics:false,expiresAt:Date.now()+600000,
 })));
 await page.goto('/?data=2028-02-29');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await page.locator('#daily-note').fill('Disposable weather preference note');await page.locator('#save-note').click();
 const cityPicker=page.locator('.weather-city-picker');const weatherCity=page.locator('#weather-city');
 const cityButton=cityPicker.getByRole('combobox',{name:/Orų miestas/});
 await expect(cityPicker).toBeVisible();await expect(cityPicker.locator('.weather-city-picker__location')).toBeVisible();await expect(cityPicker.locator('.weather-city-picker__chevron')).toBeVisible();
 await cityPicker.scrollIntoViewIfNeeded();
 const pickerBox=await cityPicker.boundingBox();expect(pickerBox.height).toBeGreaterThanOrEqual(44);expect(pickerBox.height).toBeLessThan(48);
 const chevronBox=await cityPicker.locator('.weather-city-picker__chevron').boundingBox();
 const arrowHitsControl=await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.weather-city-picker__button')),{x:chevronBox.x+chevronBox.width/2,y:chevronBox.y+chevronBox.height/2});expect(arrowHitsControl).toBe(true);
 await cityButton.focus();await expect(cityPicker).toHaveCSS('outline-style','solid');
 await cityButton.press('ArrowDown');
 const cityList=page.getByRole('listbox',{name:'Orų miestas'});
 await expect(cityList.getByRole('option')).toHaveCount(15);
 await cityButton.press('End');
 await expect(cityButton).toHaveAttribute('aria-activedescendant','weather-city-option-visaginas');
 await cityButton.press('Escape');
 await expect(cityList).toBeHidden();
 await expect(weatherCity).toHaveValue('vilnius');
 await cityButton.press('ArrowDown');
 await cityButton.press('k');
 await cityButton.press('Enter');
 await expect(cityList).toBeHidden();await expect(cityButton).toBeFocused();
 await page.locator('#seconds').uncheck();
 await expect(page.locator('#clock-zone')).toContainText('Kaunas');await page.reload();
 await expect(cityButton).toHaveAccessibleName('Orų miestas Kaunas');await expect(weatherCity).toHaveValue('kaunas');await expect(page.locator('#seconds')).not.toBeChecked();
 await expect(page.locator('#daily-note')).toHaveValue('Disposable weather preference note');
});

test('weather city changes reuse recent readings and ignore an older response', async ({ page, context }) => {
 const now = new Date('2026-11-20T17:00:00Z');
 await page.clock.setFixedTime(now);
 await context.addInitScript(() => localStorage.setItem('kalendorius365:analytics-consent:v1', JSON.stringify({
  version: 1, analytics: false, expiresAt: Date.now() + 600_000,
 })));
 await page.route('**/api/location', route => route.fulfill({ json: { city: 'vilnius' } }));
 const requests = [];
 const slowKaunas = Promise.withResolvers();
 await page.route('**/api/weather?*', async (route) => {
  const city = new URL(route.request().url()).searchParams.get('city');
  requests.push(city);
  if (city === 'kaunas') await slowKaunas.promise;
  await route.fulfill({ json: { observation: { observations: [{
   conditionCode: 'clear',
   observationTimeUtc: '2026-11-20 16:50:00',
   airTemperature: { vilnius: 1, kaunas: 5, klaipeda: 9 }[city],
  }] } } });
 });
 await page.goto('/');
 const temperature = page.locator('#weather-temp strong');
 const chooser = page.getByRole('combobox', { name: /Orų miestas/ });
 const option = (name) => page.getByRole('option', { name, exact: true });
 const select = async (name) => {
  await chooser.click();
  await option(name).click();
 };
 await expect(temperature).toHaveText('1 °C');
 const weatherFrame = await page.locator('#weather-temp').elementHandle();
 const originalHeight = (await weatherFrame.boundingBox()).height;
 await chooser.click();
 const kaunasRequest = page.waitForRequest('**/api/weather?city=kaunas');
 await option('Kaunas').hover();
 await kaunasRequest;
 await expect(temperature).toHaveText('1 °C');
 await option('Kaunas').click();
 await expect(page.locator('#weather-content')).toHaveAttribute('aria-busy', 'true');
 await expect(page.locator('.weather-loading')).toContainText('Kaunas');
 await expect(temperature).toBeHidden();
 expect((await weatherFrame.boundingBox()).height).toBe(originalHeight);
 await select('Klaipėda');
 await expect(temperature).toHaveText('9 °C');
 expect(await weatherFrame.evaluate(node => node === document.querySelector('#weather-temp'))).toBe(true);
 const kaunasFinished = page.waitForEvent('requestfinished', request => new URL(request.url()).search === '?city=kaunas');
 slowKaunas.resolve();
 await kaunasFinished;
 await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
 await expect(temperature).toHaveText('9 °C');
 await select('Vilnius');
 await expect(temperature).toHaveText('1 °C');
 await expect(page.locator('#weather-content')).not.toHaveAttribute('aria-busy', 'true');
 expect(requests).toEqual(['vilnius', 'kaunas', 'klaipeda']);

 await page.clock.setFixedTime(new Date(now.getTime() + 181_000));
 await select('Klaipėda');
 await expect(temperature).toHaveText('9 °C');
 expect(requests).toEqual(['vilnius', 'kaunas', 'klaipeda', 'klaipeda']);
});

test('the weather card separates readings and keeps the city control and arrows aligned',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
 await page.clock.setFixedTime(new Date('2026-11-20T17:00:00Z'));
 await page.route('**/api/weather?*',route=>route.fulfill({json:{
  observation:{observations:[{conditionCode:'cloudy-with-sunny-intervals',observationTimeUtc:'2026-11-20 16:50:00',airTemperature:-1,feelsLikeTemperature:-3,windSpeed:4,relativeHumidity:90}]},
  forecast:{forecastTimestamps:[{forecastTimeUtc:'2026-11-20 06:00:00',airTemperature:-4},{forecastTimeUtc:'2026-11-20 18:00:00',airTemperature:0}]},
 }}));
 await page.setViewportSize({width:320,height:900});
 await page.goto('/');
 const panel=page.locator('.weather-panel');
 await expect(panel.getByRole('heading',{name:'Orai šiandien'})).toBeVisible();
 await expect(panel.getByRole('combobox',{name:'Orų miestas Vilnius'})).toBeVisible();
 await expect(panel.locator('.weather-description')).toHaveText('Debesuota su pragiedruliais');
 await expect(panel.locator('.weather-feels dd')).toHaveText('−3 °C');
 await expect(panel.locator('.weather-time time')).toHaveAttribute('datetime','2026-11-20T16:50:00.000Z');
 await expect(panel.locator('.weather-measures dd')).toHaveText(['4 m/s','90 %']);
 await expect(panel.locator('.weather-forecast__range dt')).toHaveText(['Žemiausia','Aukščiausia']);
 await expect(panel.locator('.weather-forecast__range dd')).toHaveText(['−4 °C','0 °C']);
 for(const width of [320,390,430,560,760,971,1100,1286]){
  await page.setViewportSize({width,height:900});
  const bounds=await panel.evaluate(el=>{
   const row=el.querySelector('.weather-top').getBoundingClientRect();
   const picker=el.querySelector('.weather-city-picker').getBoundingClientRect();
   const centers=[...el.querySelectorAll('.weather-city-picker svg')].map(icon=>{
    const box=icon.getBoundingClientRect();
    return box.y+box.height/2;
   });
   const measurements=[...el.querySelectorAll('.weather-measures dt')].map(node=>node.getBoundingClientRect());
   const forecast=[...el.querySelectorAll('.weather-forecast__range dt')].map(node=>node.getBoundingClientRect());
   const sources=[...el.querySelectorAll('.weather-attribution a')].map(node=>node.getBoundingClientRect());
   const card=el.closest('.climate-card');
   const links=[...card.querySelectorAll('.climate-links a')].map(node=>node.getBoundingClientRect());
   const photo=card.querySelector('.climate-card__image');
   const clock=card.querySelector('.clock-card');
   const picture=photo.parentElement.getBoundingClientRect();
   const photoBox=photo.getBoundingClientRect();
   const clockBox=clock.getBoundingClientRect();
   const rootSize=parseFloat(getComputedStyle(document.documentElement).fontSize);
   const stacked=el.getBoundingClientRect().width<=11*rootSize;
   const compact=matchMedia('(max-width:560px)').matches;
   const photoAligned=compact
    ? Math.abs(picture.right-clockBox.left)<=1 && Math.abs(picture.top-clockBox.top)<=1
    : Math.abs(picture.bottom-clockBox.top)<=1;
   const navAligned=compact
    ? links[0].bottom<=links[1].top && Math.abs(links[1].top-links[2].top)<=1 && Math.abs(links[1].width-links[2].width)<=1
    : links.every(link=>Math.abs(link.height-links[0].height)<=1 && Math.abs(link.width-links[0].width)<=1);
   return {
    left:Math.abs(picker.left-row.left),
    right:Math.abs(picker.right-row.right),
    aligned:centers.every(y=>Math.abs(y-picker.y-picker.height/2)<=1),
    overflow:[el,...el.querySelectorAll('dt,dd,.weather-attribution a')].some(node=>node.scrollWidth>node.clientWidth+1),
    readingColumns:measurements.every((cell,index)=>Math.abs(cell.left-forecast[index].left)<=1),
    sourceAlignment:Math.abs(sources[0].height-sources[1].height)<=1
     && (stacked ? sources[0].bottom<=sources[1].top : Math.abs(sources[0].top-sources[1].top)<=1),
    linkAlignment:navAligned && links.every(link=>link.height>=44),
    clockSettings:card.querySelector('.settings-small').getBoundingClientRect().top>=clockBox.bottom,
    singleColumn:!compact || Math.abs(el.getBoundingClientRect().width-card.querySelector('.clock-photo').getBoundingClientRect().width)<=1,
    photoFits:getComputedStyle(photo).objectFit==='cover'
     &&Math.abs(photoBox.width-picture.width)<=1&&Math.abs(photoBox.height-picture.height)<=1
     &&photoAligned
     &&[clock,...clock.querySelectorAll('#clock,#clock-date,.clock-location')].every(node=>node.scrollWidth<=node.clientWidth+1),
   };
  });
  expect(bounds,`weather layout at ${width}px`).toEqual({
   left:0,right:0,aligned:true,overflow:false,readingColumns:true,sourceAlignment:true,linkAlignment:true,clockSettings:true,singleColumn:true,photoFits:true,
  });
 }
 const link=page.getByRole('link',{name:'Saulėtekis ir saulėlydis',exact:true});
 await expect(link.locator('svg.climate-link__arrow')).toBeVisible();
 await link.hover();
 await expect(link).toHaveCSS('text-decoration-line','none');
 await expect(link.locator('.climate-link__label')).toHaveCSS('text-decoration-line','underline');
});

test('upcoming dates use Vilnius today and stay above every calendar view', async ({ page, context }) => {
 await context.addInitScript(() => localStorage.setItem('kalendorius365:privacy-notice:v1', 'dismissed'));
 await page.clock.setFixedTime(new Date('2026-11-20T17:00:00Z'));
 await page.goto('/?data=2027-08-18');
 await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy', 'false');

 const upcoming = page.locator('#artimiausios-datos');
 const dates = upcoming.locator('li time');
 await expect(upcoming.getByRole('button', { name: 'Visos datos' })).toBeVisible();
 await expect(upcoming.locator('li strong')).toHaveText([
  'Pasaulinė vaiko teisių diena', 'Lietuvos kariuomenės diena', 'Kalėdos sostinėje', 'Advento pradžia',
 ]);
 await expect(dates.first()).toHaveAttribute('datetime', '2026-11-20');

 for (const width of [320, 760, 850, 970, 1180, 1440]) {
  await page.setViewportSize({ width, height: 960 });
  const layout = await upcoming.evaluate(section => {
   const region = section.getBoundingClientRect();
   const dashboard = document.querySelector('.dashboard').getBoundingClientRect();
   return {
    above: region.bottom <= dashboard.top,
    aligned: Math.abs(region.left - dashboard.left) <= 1 && Math.abs(region.width - dashboard.width) <= 1,
    fits: [...section.querySelectorAll('li a')].every(card => card.scrollWidth <= card.clientWidth + 1
      && card.getBoundingClientRect().height <= 100),
   };
  });
  expect(layout, `layout at ${width}px`).toEqual({ above: true, aligned: true, fits: true });
 }

 const official = upcoming.getByRole('button', { name: 'Šventinės dienos' });
 await official.click();
 await expect(official).toHaveAttribute('aria-pressed', 'true');
 await expect(dates.first()).toHaveAttribute('datetime', '2026-12-24');
 await expect(dates.last()).toHaveAttribute('datetime', '2027-01-01');
 await upcoming.getByRole('button', { name: 'Tradicijos' }).click();
 await expect(upcoming.getByRole('link', { name: /Advento pradžia/ })).toHaveAttribute('href', '/sventes/adventas/?metai=2026');
 await upcoming.getByRole('button', { name: 'Renginiai' }).click();
 await expect(upcoming.getByRole('link', { name: /Kalėdos sostinėje/ })).toHaveAttribute('href', '/renginiai/kaledos-sostineje/');

 for (const view of ['day', 'week', 'agenda', 'year', 'month']) {
  const button = page.locator(`[data-view="${view}"]`);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(dates.first()).toHaveAttribute('datetime', '2026-11-28');
 }

 await page.emulateMedia({ media: 'print' });
 await expect(upcoming).toBeHidden();
 await expect(page.locator('#calendar')).toBeVisible();
});

test('home guide cards have aligned links, responsive photographs and corresponding license credits', async ({ page, context }) => {
 await context.addInitScript(() => localStorage.setItem('kalendorius365:privacy-notice:v1', 'dismissed'));
 await page.setViewportSize({ width: 1286, height: 960 });
 await page.goto('/');
 const region = page.getByRole('region', { name: 'Kalendoriaus ir planavimo gidai' });
 const cards = region.locator('.home-guide');
 await expect(cards).toHaveCount(3);
 await region.scrollIntoViewIfNeeded();

 const articles = await cards.locator('a').evaluateAll(async (links) => Promise.all(links.map(async (link) => {
  const photo = link.querySelector('img');
  await photo.decode();
  return {
   url: link.getAttribute('href'),
   hasPhoto: photo.naturalWidth > 0 && !!photo.alt,
   hasVariants: photo.getAttribute('srcset').split(',').length === 3,
   action: link.querySelector('.home-guide__action').getBoundingClientRect().bottom,
  };
 })));
 expect(new Set(articles.map(({ url }) => url)).size).toBe(3);
 expect(articles.every(({ hasPhoto, hasVariants, action }) => hasPhoto && hasVariants && Math.abs(action - articles[0].action) <= 1)).toBe(true);
 for (const { url } of articles) {
  expect((await page.request.get(url)).ok()).toBe(true);
 }

 await page.setViewportSize({ width: 320, height: 960 });
 const positions = await cards.evaluateAll((items) => items.map((item) => {
  const box = item.getBoundingClientRect();
  return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
 }));
 expect(positions.every(({ left, right }, i) => left >= 0 && right <= 320 && (i === 0 || positions[i].top >= positions[i - 1].bottom))).toBe(true);
 await region.getByRole('link', { name: 'Nuotraukų autoriai ir licencijos' }).click();
 await expect(page).toHaveURL(/nuotrauku-licencijos\/#blogo-nuotraukos$/);
 for (const { url } of articles) {
  await expect(page.locator(`#blogo-nuotraukos [href="${url}"]`)).toBeVisible();
 }
});

test('homepage recommendations align their cards and keep the daily horoscope accessible', async ({ page, context }) => {
 await context.addInitScript(() => localStorage.setItem('kalendorius365:privacy-notice:v1', 'dismissed'));
 await page.goto('/');
 const discovery = page.getByRole('region', { name: 'Svarbios datos ir dienos ritmas' });
 const horoscope = page.getByRole('region', { name: 'Dienos horoskopas' });
 const mainLinks = discovery.locator('.home-discovery__grid a');
 const quickLinks = discovery.locator('.home-discovery__more a');
 await expect(mainLinks).toHaveCount(4);
 await expect(quickLinks).toHaveCount(4);
 await expect(horoscope.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
 const horoscopeLink = horoscope.getByRole('link', { name: 'Skaityti horoskopus' });

 for (const [width, columns] of [[320, 1], [390, 1], [760, 2], [950, 2], [1286, 4]]) {
  await page.setViewportSize({ width, height: 960 });
  const boxes = await mainLinks.evaluateAll((links) => links.map((link) => {
   const rect = link.getBoundingClientRect();
   const body = link.querySelector('.home-discovery__copy').getBoundingClientRect();
   return { left: rect.left, top: rect.top, right: rect.right, height: rect.height, bodyFits: body.right <= rect.right };
  }));
  expect(new Set(boxes.map(({ left }) => left)).size).toBe(columns);
  expect(boxes.every(({ left, right, height, bodyFits }) => left >= 0 && right <= width && height >= 44 && bodyFits)).toBe(true);
  expect(boxes.slice(0, columns).every(({ top, height }) => top === boxes[0].top && height === boxes[0].height)).toBe(true);
  await expect(horoscopeLink).toBeVisible();
  expect((await horoscopeLink.boundingBox()).height).toBeGreaterThanOrEqual(44);
 }
 await horoscopeLink.focus();
 await expect(horoscopeLink).toHaveCSS('outline-style', 'solid');
 await horoscopeLink.click();
 await expect(page).toHaveURL(/\/horoskopai\/$/);
 await expect(page.locator('h1')).toBeVisible();
});

test('planner summary panels use compact rows and keep calendar shortcuts and filters usable', async ({ page, context }) => {
 await context.addInitScript(() => localStorage.setItem('kalendorius365:privacy-notice:v1', 'dismissed'));
 await page.clock.setFixedTime(new Date('2026-11-20T17:00:00Z'));
 await page.goto('/?data=2026-11-20');
 await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy', 'false');
 const panel = page.locator('.upcoming-events-panel');
 await expect(panel.locator('.upcoming-events-empty')).toBeVisible();
 await expect(page.locator('#today-facts dd')).toHaveText(['324', '10 d.', '41 d.']);
 await expect(page.locator('.dashboard-year-links a')).toHaveCount(4);
 const weekPlan = page.locator('.home-week-plan');
 await expect(page.locator('.dashboard-extras .mini-calendar')).toHaveCount(0);
 await expect(weekPlan.locator('dd')).toHaveText(['5', '40 val.']);
 await expect(weekPlan.locator('#plan-next-workday time')).toHaveAttribute('datetime', '2026-11-23');

 for (const width of [320, 850, 1286]) {
  await page.setViewportSize({ width, height: 920 });
  expect((await panel.boundingBox()).height).toBeLessThan(95);
  const factPositions = await page.locator('#today-facts dd').evaluateAll((values) =>
   values.map((value) => value.getBoundingClientRect().top),
  );
  expect(new Set(factPositions).size).toBe(1);
  await expect(page.locator('.home-upcoming__list li a')).toHaveCount(4);
  await expect(weekPlan).toBeVisible();
  expect(await weekPlan.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
 }
 const holidays = page.getByRole('checkbox', { name: 'Lietuvos šventės' });
 await holidays.uncheck();
 await expect(page.locator('.filter-chip--holiday')).toHaveAttribute('aria-pressed', 'false');
 await holidays.check();
 await weekPlan.locator('#plan-next-workday').click();
 await expect(page.locator('#selected-title')).toContainText('lapkričio 23');
 await page.locator('#next').click();
 await page.locator('#calendar [data-date="2026-12-25"]').click();
 await expect(page.locator('#selected-title')).toContainText('gruodžio 25');
 await expect(weekPlan.locator('dd')).toHaveText(['3', '23 val.']);
 await expect(weekPlan.locator('#plan-next-workday time')).toHaveAttribute('datetime', '2026-12-28');
 await expect(weekPlan.locator('#plan-week-calculator')).toHaveAttribute('href', '/datos-skaiciuokle/?nuo=2026-12-21&iki=2026-12-27&imtinai=1');
 await page.locator('#add-event').click();
 const form = page.locator('#event-form');
 await form.locator('[name=title]').fill('Bandomasis įvykis');
 await form.locator('[name=allDay]').check();
 await form.locator('button[type=submit]').click();
 const event = panel.locator('.upcoming-event').filter({ hasText: 'Bandomasis įvykis' });
 await expect(event.locator('time')).toHaveAttribute('datetime', '2026-12-25');
 await event.getByRole('button', { name: 'Redaguoti Bandomasis įvykis' }).click();
 await expect(form.locator('[name=title]')).toHaveValue('Bandomasis įvykis');
 await page.locator('#close-event').click();
 await page.locator('.dashboard-year-links a[href="/2030/"]').click();
 await expect(page).toHaveURL(/\/2030\/$/);
});

test('personal calendar date search, invalid date feedback and category filters update actual state',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
 await page.goto('/');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await page.locator('#search').fill('2028-02-30');await expect(page.locator('#search-results')).toContainText('Neteisinga data');
 await page.locator('#search').fill('2028-02-29');await page.locator('#search-results [data-date="2028-02-29"]').click();
 await expect(page.locator('#period-title')).toContainText('2028 m. vasaris');
 const filters = page.locator('.calendar-filters');
 if ((await filters.getAttribute('open')) === null) await filters.locator('summary').click();
 await page.locator('.filter-chip--holiday').click();await expect(page.locator('.filter-chip--holiday')).toHaveAttribute('aria-pressed','false');
 await page.locator('#category-chips').getByRole('button',{name:'Visi įvykiai',exact:true}).click();
 await expect(page.locator('.filter-chip--holiday')).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(page.locator('.filter-chip--holiday')).toHaveAttribute('aria-pressed','true');
});

test('the phone tool menu fits the visible screen before and during search', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 844 });
  await page.goto('/');
  const opener = page.locator('#tools-open');
  const label = await opener.locator('span').boundingBox();
  const arrow = await opener.locator('.shell-chevron').boundingBox();
  expect(label.x + label.width).toBeLessThan(arrow.x);
  await opener.click();
  const menu = page.locator('#tools-dialog');
  const close = menu.getByRole('button', { name: 'Užverti įrankių meniu' });
  await expect(close).toBeFocused();
  await expect(menu).toHaveCSS('width', '430px');
  await expect(menu).toHaveCSS('height', '844px');
  expect(await menu.evaluate(el => el.scrollWidth)).toBe(430);
  expect(await menu.locator('.tools-dialog__categories').evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);

  const search = menu.getByRole('searchbox', { name: 'Ieškoti įrankio' });
  await expect(search).toHaveCSS('font-size', '16px');
  await search.fill('datos');
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, value: 425 });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(menu).toHaveCSS('height', '425px');
  await expect(close).toBeVisible();
  await expect(menu.getByRole('link', { name: /Datos skaičiuoklė/ }).first()).toBeVisible();
  await close.click();
  await expect(menu).toBeHidden();
  await expect(opener).toBeFocused();
});
