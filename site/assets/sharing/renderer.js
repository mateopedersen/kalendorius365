import {FORMATS,lt} from './i18n.js';
import {excerptFor,shorten,validateRecord} from './model.js';
const themes={light:{bg:'#f3f7f5',paper:'#fffdf9',ink:'#111b2e',muted:'#4b5c64',accent:'#006a44'},dark:{bg:'#101b2b',paper:'#17273b',ink:'#fffdf9',muted:'#d0d9e1',accent:'#8cdec0'},accent:{bg:'#006a44',paper:'#f2faf5',ink:'#123a2d',muted:'#47645a',accent:'#006a44'}};
let fontPromise;
async function fonts(){if(!fontPromise)fontPromise=Promise.all([['ShareLato', '/assets/fonts/Lato-Regular.ttf','400'],['ShareLato','/assets/fonts/Lato-Bold.ttf','700']].map(async([family,url,weight])=>{const f=new FontFace(family,`url(${url})`,{weight});await f.load();document.fonts.add(f);}));return fontPromise.catch(e=>{fontPromise=null;throw e;});}
function assetUrl(value){const u=new URL(value,location.href);if(u.origin==='https://kalendorius365.lt'&&location.origin!=='https://kalendorius365.lt')return `${location.origin}${u.pathname}${u.search}`;return u.href;}
function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('image_load'));img.src=assetUrl(url);});}
function lines(ctx,text,maxWidth,maxLines){const result=[];let line='';for(const word of text.split(/\s+/u)){const next=(line+' '+word).trim();if(line&&ctx.measureText(next).width>maxWidth){result.push(line);line=word;}else line=next;}if(line)result.push(line);if(result.length>maxLines){result.length=maxLines;result[maxLines-1]=shorten(result[maxLines-1],Math.max(2,Array.from(result[maxLines-1]).length-3))+'…';}return result;}
function write(ctx,text,x,y,w,size,leading,count,color,weight=400){ctx.fillStyle=color;ctx.font=`${weight} ${size}px ShareLato`;const rows=lines(ctx,text,w,count);for(const row of rows){ctx.fillText(row,x,y);y+=leading;}return y;}
function fit(ctx,img,x,y,w,h){const scale=Math.min(w/img.width,h/img.height);const dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
export async function renderCard(raw,{format='story',theme='light',section='lead',mime='image/png'}={}){
 const p=validateRecord(raw);if(!FORMATS[format]||!themes[theme]||!['image/png','image/jpeg'].includes(mime))throw new Error('render_options');
 const [w,h]=FORMATS[format],t=themes[theme];await fonts();const img=await loadImage(p.artwork);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');if(!c)throw new Error('canvas_unavailable');
 c.fillStyle=t.bg;c.fillRect(0,0,w,h);const landscape=format==='link';const margin=landscape?44:64;const top=landscape?32:format==='story'?210:format==='pinterest'?115:72;const bottom=landscape?32:format==='story'?190:80;
 c.fillStyle=t.paper;c.beginPath();c.roundRect(margin,top,w-margin*2,h-top-bottom,landscape?28:40);c.fill();
 const x=margin+46,inside=w-margin*2-92;c.fillStyle=t.accent;c.font='700 26px ShareLato';c.fillText('KALENDORIUS365',x,top+55);
 let excerpt=excerptFor(p,section,landscape?155:format==='square'?165:240);
 if(landscape){fit(c,img,x,top+84,350,h-top-bottom-180);let y=write(c,p.kind==='horoscope'?p.signName:p.title,x+395,top+122,inside-395,42,51,2,t.ink,700);y=write(c,p.displayDate||(p.year?`${p.year} metai`:''),x+395,y+13,inside-395,24,32,1,t.muted);write(c,excerpt,x+395,y+25,inside-395,26,36,4,t.ink);}
 else{
  const title=p.kind==='horoscope'?p.signName:p.title;let y=write(c,title,x,top+118,inside,format==='square'?46:58,format==='square'?56:68,2,t.ink,700);y=write(c,p.displayDate||(p.year?`${p.year} metai`:''),x,y+12,inside,28,38,2,t.muted);
  const artTop=y+16,quoteSize=format==='square'?30:34,quoteLeading=format==='square'?40:46,quoteLines=format==='story'?6:format==='square'?3:4;
  const artH=Math.max(100,Math.min(format==='story'?465:format==='post'?330:format==='pinterest'?370:260,h-bottom-110-artTop-quoteLines*quoteLeading-32));fit(c,img,x,artTop,inside,artH);y=artTop+artH+42;
  const remainingLines=Math.max(1,Math.floor((h-bottom-90-y)/quoteLeading)+1);write(c,`„${excerpt}“`,x,y,inside,quoteSize,quoteLeading,Math.min(quoteLines,remainingLines),t.ink);
 }
 c.strokeStyle=theme==='dark'?'#44556a':'#d7e5dc';c.lineWidth=2;c.beginPath();c.moveTo(x,h-bottom-73);c.lineTo(w-x,h-bottom-73);c.stroke();c.fillStyle=t.accent;c.font='700 24px ShareLato';c.fillText('kalendorius365.lt',x,h-bottom-33);
 if(p.kind==='horoscope'){c.textAlign='right';c.fillStyle=t.muted;c.font='400 20px ShareLato';c.fillText(lt.entertainment,w-x,h-bottom-33);c.textAlign='left';}
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('render_blob')),mime,.94));
 if(blob.size>15*1024*1024)throw new Error('render_size');const identity=p.signSlug||p.contentId;const filename=`kalendorius365-${identity.replace(/[^a-z0-9-]/g,'-').slice(0,90)}-${p.contentDate||p.year||'svetaine'}-${format}.${mime==='image/png'?'png':'jpg'}`;
 return {file:new File([blob],filename,{type:mime}),width:w,height:h};
}
