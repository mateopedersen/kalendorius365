import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),__dirname=fileURLToPath(new URL('.',import.meta.url));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../site/assets/calendar-downloads.js'),'utf8');
function browser(){
 const urls=new Map(),anchors=[],timers=[];let serial=0;
 const document={body:{append(a){a.connected=true;anchors.push(a);}},createElement(tag){assert.equal(tag,'a');return {connected:false,remove(){this.connected=false;},click(){assert.ok(this.connected,'Safari must receive a connected link');assert.ok(urls.has(this.href),'file must exist at click time');this.clicked=true;}};}};
 const context={Blob,File,document,URL:{createObjectURL(blob){const u='blob:test-'+(++serial);urls.set(u,blob);return u;},revokeObjectURL(u){urls.delete(u);}},setTimeout(fn,ms){timers.push({fn,ms});return {unref(){}};}};
 vm.runInNewContext(source,context);
 return {api:context.Calendar365Downloads,urls,anchors,timers};
}
const calendar='BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:one@example.test\nDTSTAMP:20261114T120000Z\nDTSTART;VALUE=DATE:20270101\nDTEND;VALUE=DATE:20270102\nSUMMARY:Āboli šventė päivä\nBEGIN:VALARM\nACTION:DISPLAY\nTRIGGER:-P1D\nDESCRIPTION:Remember\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR\n';
test('Safari can read the named ICS after a delayed save confirmation',async()=>{
 const b=browser(),url=b.api.save(calendar,'svētki.ics','text/calendar;charset=utf-8');
 for(const t of b.timers.filter(t=>t.ms<=30000))t.fn();
 assert.ok(b.urls.has(url),'confirmation delay must not invalidate the download');
 assert.ok(b.anchors[0].connected);
 const file=b.urls.get(url);assert.equal(file.name,'svētki.ics');assert.match(file.type,/^text\/calendar/);
 assert.equal(await file.text(),calendar.replaceAll('\n','\r\n'));
 for(const t of b.timers)t.fn();assert.equal(b.urls.size,0);assert.equal(b.anchors[0].connected,false);
});
test('replacing a prepared link leaves the old calendar alive for Safari',()=>{
 const b=browser();b.urls.set('blob:prepared',new Blob([calendar]));b.api.release('blob:prepared');b.api.release('blob:prepared');
 assert.equal(b.timers.length,1);assert.ok(b.urls.has('blob:prepared'));assert.ok(b.timers[0].ms>=60000);
 b.timers[0].fn();assert.ok(!b.urls.has('blob:prepared'));
});
test('empty calendars are rejected before generating an unimportable download',()=>{
 const b=browser();assert.throws(()=>b.api.save('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n','empty.ics','text/calendar'));
 assert.equal(b.anchors.length,0);assert.equal(b.urls.size,0);
});
test('binary calendars, repeated downloads and other exports preserve bytes',async()=>{
 const b=browser(),raw=new TextEncoder().encode(calendar.replaceAll('\n','\r\n'));
 const first=b.api.save(raw,'first.ics','text/calendar'),second=b.api.save(new Blob([raw]),'second.ics','text/calendar');
 assert.notEqual(first,second);assert.deepEqual(new Uint8Array(await b.urls.get(second).arrayBuffer()),raw);
 const json=b.api.save('{"events":[]}', 'backup.json','application/json');assert.equal(await b.urls.get(json).text(),'{"events":[]}');
});
