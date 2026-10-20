import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const months=['sausis','vasaris','kovas','balandis','geguze','birzelis','liepa','rugpjutis','rugsejis','spalis','lapkritis','gruodis'];
test('all 36 seasonal illustrations contain the actual Monday-first calendar for their destination',()=>{
 const themes=new Set();
 for(const year of [2027,2028,2029]) for(const [index,slug] of months.entries()){
  const svg=readFileSync(new URL(`../site/assets/visuals/month-calendars/${year}-${slug}.svg`,import.meta.url),'utf8');
  const days=[...svg.matchAll(/<text data-day="(\d+)" x="(\d+)" y="(\d+)"/g)];
  const expectedCount=new Date(Date.UTC(year,index+1,0)).getUTCDate();
  assert.equal(days.length,expectedCount,`${year}/${slug} length`);
  for(const [day,x,y] of days.map(m=>m.slice(1).map(Number))){
   const date=new Date(Date.UTC(year,index,day));
   const col=(date.getUTCDay()+6)%7;
   const offset=(new Date(Date.UTC(year,index,1)).getUTCDay()+6)%7;
   assert.equal(x,52+col*20,`${year}/${slug}/${day} weekday`);
   assert.equal(y,140+Math.floor((offset+day-1)/7)*12,`${year}/${slug}/${day} row`);
  }
  assert.doesNotMatch(svg,/<script|<foreignObject|https?:\/\/(?!www.w3.org\/2000\/svg)/);
  if(year===2027)themes.add(svg.match(/<desc[^>]*>(.*?)\./)[1]);
 }
 assert.equal(themes.size,12,'a separate seasonal concept for every month');
});
