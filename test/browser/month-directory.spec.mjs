import { test, expect } from '@playwright/test';

test('month directory loads 48 distinct calendar illustrations and keeps card content aligned',async({page})=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/menesiai/');
 const consent=page.getByRole('button',{name:'Supratau',exact:true});
 if(await consent.isVisible())await consent.click();
 const cards=page.locator('.month-directory-card');
 await expect(cards).toHaveCount(48);
 const artwork=await cards.locator('img').evaluateAll(images=>Promise.all(images.map(async image=>{
  image.loading='eager';
  await image.decode();
  return {url:image.src,width:image.naturalWidth};
 })));
 expect(new Set(artwork.map(image=>image.url)).size).toBe(48);
 expect(artwork.every(image=>image.width>0)).toBeTruthy();
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  const layout=await cards.evaluateAll(rows=>rows.map(c=>{
    const image=c.querySelector('img').getBoundingClientRect(),copy=c.querySelector('.month-directory-card__copy').getBoundingClientRect(),outer=c.getBoundingClientRect();
    return {href:c.pathname,imageRight:image.right,copyLeft:copy.left,copyRight:copy.right,outerRight:outer.right,scroll:c.scrollWidth,client:c.clientWidth};
  }));
  for(const boxes of layout){
   const description=`${boxes.href} at ${width}px`;
   expect(boxes.imageRight,description).toBeLessThanOrEqual(boxes.copyLeft);
   expect(boxes.copyRight,description).toBeLessThanOrEqual(boxes.outerRight);
   expect(boxes.scroll,description).toBeLessThanOrEqual(boxes.client+1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 }
 expect(errors).toEqual([]);
});

test('the monthly artwork links to its corresponding calendar and preserves leap February',async({page})=>{
 await page.goto('/menesiai/');
 const february=page.locator('.month-directory-card[href="/2028/vasaris/"]');
 await expect(february.locator('p')).toContainText('29 d.');
 await february.click();
 await expect(page).toHaveURL(/\/2028\/vasaris\/$/);
 await expect(page.locator('h1')).toContainText('2028 m. vasario');
});
