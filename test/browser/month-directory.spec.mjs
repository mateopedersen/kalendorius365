import { test, expect } from '@playwright/test';

test('month directory loads 36 distinct calendar illustrations and keeps card content aligned',async({page})=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/menesiai/');
 const consent=page.getByRole('button',{name:'Supratau',exact:true});
 if(await consent.isVisible())await consent.click();
 const cards=page.locator('.month-directory-card');
 await expect(cards).toHaveCount(36);
 const urls=await cards.locator('img').evaluateAll(imgs=>imgs.map(i=>i.src));
 expect(new Set(urls).size).toBe(36);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(let i=0;i<36;i++){
   const card=cards.nth(i);await card.scrollIntoViewIfNeeded();
   expect(await card.locator('img').evaluate(async i=>{i.loading='eager';await i.decode();return i.naturalWidth>0;})).toBeTruthy();
   const boxes=await card.evaluate(c=>{
    const image=c.querySelector('img').getBoundingClientRect(),copy=c.querySelector('.month-directory-card__copy').getBoundingClientRect(),outer=c.getBoundingClientRect();
    return {imageRight:image.right,copyLeft:copy.left,copyRight:copy.right,outerRight:outer.right,scroll:c.scrollWidth,client:c.clientWidth};
   });
   expect(boxes.imageRight).toBeLessThanOrEqual(boxes.copyLeft);
   expect(boxes.copyRight).toBeLessThanOrEqual(boxes.outerRight);
   expect(boxes.scroll).toBeLessThanOrEqual(boxes.client+1);
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
