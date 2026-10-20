import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateRecord,publicUrl,graphemes,vilniusDate,shareText,combinedText,excerptFor} from '../site/assets/sharing/model.js';
import {PLATFORMS,intentUrl} from '../site/assets/sharing/platforms.js';

const root='https://kalendorius365.lt';
const record=(extra={})=>({kind:'horoscope',contentId:'horoscope-avinas-2026-10-20-0123456789abcdef',canonicalUrl:`${root}/horoskopai/avinas/2026-10-20/v-0123456789abcdef/`,shareUrl:`${root}/horoskopai/avinas/2026-10-20/v-0123456789abcdef/`,title:'Avinas · 2026 m. spalio 20 d.',excerpt:'Dienos žinutė',locale:'lt-LT',timezone:'Europe/Vilnius',contentDate:'2026-10-20',contentVersion:'0123456789abcdef',signSlug:'avinas',signName:'Avinas',displayDate:'2026 m. spalio 20 d.',imageUrl:`${root}/assets/sharing/og/0123456789abcdef01234567.png`,artwork:'/assets/sharing/artwork/avinas-0123456789ab.png',sections:{lead:'Dienos žinutė',relationships:'Kalbėkitės atvirai.',work:'Užbaikite pradėtą darbą.'},...extra});

test('public share records reject foreign origins and strip user controlled query data',()=>{
 assert.equal(publicUrl(`${root}/2027/?private=1#personal`),`${root}/2027/`);
 assert.throws(()=>publicUrl('https://evil.example/'),/invalid_public_url/);
 assert.throws(()=>publicUrl('javascript:alert(1)'),/invalid_public_url/);
 const p=validateRecord({...record(),privateCalendar:'SECRET',personalNote:'SECRET',ics:'SECRET',analytics:'SECRET',unknown:'SECRET'});
 assert.equal('personalNote' in p,false);assert.equal('privateCalendar' in p,false);assert.equal('ics' in p,false);assert.equal('unknown' in p,false);
 assert.deepEqual(Object.keys(p.sections).sort(),['lead','relationships','work']);
 assert.equal(validateRecord({...record(),sections:{...record().sections,personalNote:'SECRET'}}).sections.personalNote,undefined);
});

test('snapshot date, version and sign form one strict permanent identity',()=>{
 assert.doesNotThrow(()=>validateRecord(record()));
 for(const invalid of [{contentDate:'2026-02-30'},{contentVersion:'current'},{signSlug:'bad'},{shareUrl:`${root}/horoskopai/avinas/`},{canonicalUrl:'https://evil.example/'}])assert.throws(()=>validateRecord({...record(),...invalid}));
});

test('Vilnius date and today/archive copy always use the published content date',()=>{
 assert.equal(vilniusDate(new Date('2026-10-19T22:30:00Z')),'2026-10-20');
 const p=validateRecord(record());
 assert.match(shareText(p,{now:new Date('2026-10-19T22:30:00Z')}),/^Šiandien mano horoskopas sako:/u);
 assert.match(shareText(p,{now:new Date('2026-10-20T22:30:00Z')}),/^Mano horoskopas ·/u);
 assert.match(shareText(p),/^Mano horoskopas ·/u);
 assert.match(shareText(p,{section:'relationships'}),/Kalbėkitės atvirai/u);
 assert.match(shareText(p,{section:'work'}),/Užbaikite pradėtą darbą/u);
 assert.equal(excerptFor(p,'personalNote'),p.excerpt);
 assert.equal(combinedText(p).split(p.shareUrl).length-1,1);
 for(const [utc,local]of [['2026-03-28T22:30:00Z','2026-03-29'],['2026-03-29T21:30:00Z','2026-03-30'],['2026-10-24T21:30:00Z','2026-10-25'],['2026-10-25T21:30:00Z','2026-10-25'],['2026-10-25T22:30:00Z','2026-10-26']])assert.equal(vilniusDate(new Date(utc)),local);
});

test('all twelve visible horoscope pages and card actions use their immutable publication identity',()=>{
 const current=JSON.parse(readFileSync(new URL('../site/_data/horoscope_current.json',import.meta.url)));
 const signs=JSON.parse(readFileSync(new URL('../site/_data/horoscope_signs.json',import.meta.url)));
 const hub=readFileSync(new URL('../public/horoskopai/index.html',import.meta.url),'utf8');
 for(const sign of signs){
  const html=readFileSync(new URL(`../public/horoskopai/${sign.key}/index.html`,import.meta.url),'utf8');
  const p=validateRecord(JSON.parse(html.match(/<script type="application\/json" id="share-page-data">(.*?)<\/script>/s)[1]));
  const expected=current.forecasts.find(f=>f.sign_key===sign.key);
  assert.equal(p.contentDate,current.local_date);assert.equal(p.contentVersion,current.content_checksum.slice(0,16));assert.equal(p.signName,sign.name);assert.equal(p.sections.lead,expected.lead);
  assert.ok(html.includes(`data-share-key="${p.contentId}"`),sign.key);assert.ok(hub.includes(`data-share-key="${p.contentId}"`),sign.key);
  const saved=validateRecord(JSON.parse(readFileSync(new URL(`../site/assets/sharing/records/${p.contentId}.json`,import.meta.url))));
  assert.equal(saved.shareUrl,p.shareUrl);assert.equal(saved.canonicalUrl,saved.shareUrl);assert.deepEqual(saved.sections,p.sections);
 }
});

test('all declared platform builders use the correct public payload without duplicate links',()=>{
 const p=validateRecord(record());assert.equal(PLATFORMS.length,13);
 for(const item of PLATFORMS){if(item.method==='prepare'||item.method==='mailto')continue;const u=new URL(intentUrl(item.id,p));assert.equal(u.protocol,'https:');assert.equal(u.searchParams.has('url')||u.searchParams.has('u')||u.searchParams.has('text')||u.searchParams.has('canonicalUrl'),true);}
 const x=new URL(intentUrl('x',p));assert.equal(x.searchParams.getAll('url').length,1);assert.ok(!x.searchParams.get('text').includes(p.shareUrl));
 const sky=new URL(intentUrl('bluesky',p));assert.equal(graphemes(sky.searchParams.get('text')).length<=300,true);assert.equal(sky.searchParams.get('text').split(p.shareUrl).length-1,1);
 const pin=new URL(intentUrl('pinterest',p));assert.equal(new URL(pin.searchParams.get('media')).protocol,'https:');assert.equal(pin.searchParams.get('url'),p.shareUrl);
 assert.equal(new URL(intentUrl('mastodon',p)).origin,'https://share.joinmastodon.org');
 assert.equal(intentUrl('instagram',p),null);
});

test('Unicode limits count graphemes instead of splitting Lithuanian letters or emoji',()=>{
 const p=validateRecord(record({title:'Labai ilgas įrašas',excerpt:'Ąčęėįšųūž šeima 👨‍👩‍👧‍👦'}));
 const text=shareText(p,{caption:'ą'.repeat(500),short:true});assert.ok(graphemes(text).length<400);
 const sky=new URL(intentUrl('bluesky',p,{caption:'✨'.repeat(600)}));assert.ok(graphemes(sky.searchParams.get('text')).length<=300);
});

for(const [year,month] of [[2027,13],[2026,1]])test(`calendar allowlist rejects ${year}/${month}`,()=>assert.throws(()=>validateRecord({kind:'calendar',contentId:'calendar',canonicalUrl:`${root}/2027/`,shareUrl:`${root}/2027/`,title:'2027',excerpt:'Kalendorius',locale:'lt-LT',timezone:'Europe/Vilnius',imageUrl:`${root}/assets/sharing/og/0123456789abcdef01234567.png`,year,month})));
test('undated blank design links have a public preview identity without an invented date',()=>{
 const p=validateRecord({kind:'design',contentId:'design-tuscias-01',canonicalUrl:`${root}/dalintis/kalendorius/tuscias-01/`,shareUrl:`${root}/dalintis/kalendorius/tuscias-01/`,title:'Tuščias mėnesio kalendorius',excerpt:'Nedatuotas šablonas',locale:'lt-LT',timezone:'Europe/Vilnius',imageUrl:`${root}/assets/sharing/og/0123456789abcdef01234567.png`,templateId:'tuscias-01',designType:'blank'});
 assert.equal(p.year,undefined);assert.equal(p.contentDate,undefined);assert.equal(p.designType,'blank');
});

test('social marks match the official local asset manifest and SVG sanitization policy',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../site/assets/sharing/brand-assets.json',import.meta.url)));
 for(const [id,item]of Object.entries(manifest)){if(!item.localPath)continue;const bytes=readFileSync(new URL('../site'+item.localPath,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,id);if(item.localPath.endsWith('.svg')){const svg=bytes.toString();assert.doesNotMatch(svg,/<script|<foreignObject|\son[a-z]+\s*=/iu,id);assert.doesNotMatch(svg,/(?:href|src)=["']https?:/iu,id);assert.doesNotMatch(svg,/<image\b(?![^>]*\b(?:href|xlink:href)=)[^>]*\/?\s*>/iu,`${id} must not contain an empty SVG image placeholder`);}}
 assert.equal(manifest.linkedin.status,'official-usage-restricted-text-fallback');assert.equal(manifest.linkedin.localPath,null);
});
