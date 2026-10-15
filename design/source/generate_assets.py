from pathlib import Path
import json,shutil
from PIL import Image
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
R=Path.cwd(); V=R/'site/assets/visuals'; V.mkdir(exist_ok=True)
meta=json.loads((R/'design/docs/asset-prompts.json').read_text())
for e in meta:
 src=R/e['master']; dest=R/'design/masters'/f"{e['name']}.png"
 if src.resolve()!=dest.resolve():shutil.copyfile(src,dest)
 im=Image.open(src).convert('RGB');e['native_dimensions']=list(im.size);e['master']='design/masters/'+dest.name;e.pop('source',None);e['exports']=[]
 for w in [640,1280]:
  out=V/f"{e['name']}-{w}.webp";size=(w,round(w*im.height/im.width));im.resize(size,Image.Resampling.LANCZOS).save(out,'WEBP',quality=85,method=6);e['exports'].append({'path':str(out.relative_to(R)),'dimensions':list(size),'bytes':out.stat().st_size})
(R/'design/docs/asset-prompts.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
for weight in ['Regular','Bold','Black']:
 font=TTFont(R/f'design/source/lato/Lato-{weight}.ttf');opt=subset.Options();opt.flavor='woff2';opt.name_IDs=['*'];sub=subset.Subsetter(options=opt);sub.populate(unicodes=list(range(0x20,0x250))+list(range(0x2000,0x2070))+[0x20ac,0x2190,0x2192,0x2212]);sub.subset(font);font.flavor='woff2';font.save(R/f'site/assets/fonts/Lato-{weight}.woff2')
 assert all(ord(c) in font.getBestCmap() for c in 'ĄČĘĖĮŠŲŪŽąčęėįšųūž')
shutil.copyfile(R/'design/source/lato/OFL.txt',R/'site/assets/fonts/Lato-OFL.txt')
icons={
'calendar':'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3m-10 3h3"/>',
'year':'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h1m3 0h1m3 0h1m-9 3h1m3 0h1m3 0h1"/>',
'print':'<path d="M7 8V3h10v5M7 17H3v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7h-4M7 14h10v7H7zM17 11h1"/>',
'pdf':'<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10zM13 3v7h7M8 17l2-5 2 5m-3-2h2m4-2v4m0-2h2"/>',
'image':'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
'note':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8m-8 4h4"/>',
'tasks':'<rect x="4" y="4" width="16" height="17" rx="3"/><path d="M9 3h6v4H9zm-1 11 3 3 5-6"/>',
'gift':'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13m0-13C6 9 4 3 8 3c3 0 4 5 4 5Zm0 0c6 1 8-5 4-5-3 0-4 5-4 5Z"/>',
'briefcase':'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12c5 4 13 4 18 0m-9 1v4"/>',
'cloud':'<path d="M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11Z"/>',
'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
'moon':'<path d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11Z"/>',
'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
'search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
'chevron-left':'<path d="m14 5-7 7 7 7"/>',
'chevron-right':'<path d="m10 5 7 7-7 7"/>',
'chevron-down':'<path d="m6 9 6 6 6-6"/>',
'arrow':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
'filter':'<path d="M3 4h18l-7 8v7l-4 2v-9z"/>',
'download':'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
'upload':'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
'share':'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3m-6 7 6 3"/>',
'settings':'<path d="M4 7h16M4 17h16"/><rect x="7" y="4" width="4" height="6" rx="1"/><rect x="14" y="14" width="4" height="6" rx="1"/>',
'pin':'<path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
'plus':'<path d="M12 4v16M4 12h16"/>',
'close':'<path d="m6 6 12 12M6 18 18 6"/>',
'check':'<path d="m5 12 4 4L19 6"/>',
'menu':'<path d="M4 6h16M4 12h16M4 18h16"/>',
'edit':'<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
'shield':'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
'wind':'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 17h5a2 2 0 1 1-2 2"/>',
'drop':'<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>',
'book':'<path d="M12 5v16M3 3c4 0 7 1 9 3 2-2 5-3 9-3v15c-4 0-7 1-9 3-2-2-5-3-9-3z"/>',
'palette':'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-2-1-1-3 1-3h3c4 0 3-11-6-11Z"/><path d="M7 9h.1M11 6h.1M16 8h.1M6 14h.1"/>',
'layout':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>'}
base='xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
D=R/'design/source/icons';D.mkdir(exist_ok=True)
for n,paths in icons.items():(D/f'{n}.svg').write_text(f'<svg {base}>{paths}</svg>\n')
(V/'icons.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"><defs>'+''.join(f'<symbol id="{n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{p}</symbol>' for n,p in icons.items())+'</defs></svg>')
(R/'site/assets/icons.js').write_text('''export function icon(name, className = "") {
 const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
 svg.setAttribute("class", "icon " + className); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
 const use = document.createElementNS(svg.namespaceURI,"use"); use.setAttribute("href", "/assets/visuals/icons.svg#" + name); svg.append(use); return svg;
}\n''')
mark='<rect x="4" y="7" width="29" height="29" rx="6" fill="#006A44"/><path d="M4 15h29" stroke="#fff" stroke-opacity=".45"/><path d="M12 3v8m13-8v8" stroke="#006A44" stroke-width="3" stroke-linecap="round"/><path d="m12 24 4 4 9-9" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 31h10v4H28z" fill="#FDB913"/><path d="M28 35h10v4H28z" fill="#006A44"/><path d="M28 39h10v4H28z" fill="#C1272D"/>'
(V/'brand-mark.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 46">{mark}</svg>')
(R/'site/assets/favicon.svg').write_text((V/'brand-mark.svg').read_text())
f=TTFont(R/'design/source/lato/Lato-Black.ttf');gs=f.getGlyphSet();cmap=f.getBestCmap();scale=28/f['head'].unitsPerEm;x=52;paths=[]
for c in 'Kalendorius365.lt':
 name=cmap[ord(c)];p=SVGPathPen(gs);gs[name].draw(p);color='#006A44' if len(paths)>=11 else '#111b2e';paths.append(f'<path fill="{color}" transform="translate({x:.3f} 32) scale({scale} {-scale})" d="{p.getCommands()}"/>');x+=gs[name].width*scale
for mode in ['light','dark']:
 text=''.join(paths);text=text if mode=='light' else text.replace('#111b2e','#f2f5fa').replace('#006A44','#69d7ac')
 (V/f'logo-{mode}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x+2:.2f} 46" role="img" aria-label="Kalendorius365.lt">{mark}{text}</svg>')
# Native vector source artwork, independent of bitmap resolution.
(V/'empty-calendar.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 96"><path d="M20 79c-16-12-12-45 9-54s67-17 87 0 20 46-1 55Z" fill="#edf6f1"/><g transform="rotate(-8 69 48)"><rect x="40" y="13" width="65" height="68" rx="8" fill="white" stroke="#90bda9"/><path d="M40 31h65M55 9v12m34-12v12" fill="none" stroke="#006a44" stroke-width="3" stroke-linecap="round"/><path d="M52 42h8m9 0h8m9 0h8M52 54h8m9 0h8m9 0h8M52 66h8m9 0h8" stroke="#c8d8d0" stroke-width="3" stroke-linecap="round"/></g><circle cx="107" cy="68" r="17" fill="#006a44"/><path d="M99 68h16m-8-8v16" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="m18 37 3 3 3-3-3-3Zm97-22 4 4 4-4-4-4Z" fill="#fdb913"/></svg>''')
(V/'woven-ribbon.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3840 160"><defs><pattern id="weave" width="80" height="80" patternUnits="userSpaceOnUse"><path d="m0 40 40-40 40 40-40 40Zm20 0 20-20 20 20-20 20Z" fill="none" stroke="#006a44" stroke-opacity=".18" stroke-width="2"/><path d="m32 40 8-8 8 8-8 8Z" fill="#fdb913" fill-opacity=".7"/></pattern></defs><rect width="3840" height="160" fill="url(#weave)"/></svg>''')
# Four precise scalable weather illustrations use the same craft and palette.
for weather in ['sun','cloud','rain','snow','fog']:
 sky='<circle cx="47" cy="39" r="22" fill="#FDB913"/><path d="M47 6v-5m0 76v-6M14 39H8m78 0h-6M24 16l-4-4m50 50 4 4m-50-4-4 4m50-50 4-4" stroke="#f7ae00" stroke-width="3" stroke-linecap="round"/>' if weather=='sun' else ''
 cloud='<path d="M34 72a19 19 0 0 1-3-38 27 27 0 0 1 51 4 17 17 0 0 1-2 34Z" fill="url(#cloud)" stroke="#a8bfd0" stroke-width="1"/>'
 tail='<path d="m42 82-5 9m22-9-5 9m22-9-5 9" stroke="#4b9bd6" stroke-width="4" stroke-linecap="round"/>' if weather=='rain' else '<path d="M43 80v13m-6-10 12 7m-12 0 12-7m26-3v13m-6-10 12 7m-12 0 12-7" stroke="#6b9fbd" stroke-width="2"/>' if weather=='snow' else '<path d="M23 81h65m-58 9h50" stroke="#a3b9c9" stroke-width="3" stroke-linecap="round"/>' if weather=='fog' else ''
 (V/f'weather-{weather}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 100"><defs><linearGradient id="cloud" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#c4d6e2"/></linearGradient></defs>{sky}{cloud}{tail}</svg>')
print(json.dumps([{'name':e['name'],'source':e['native_dimensions'],'web_bytes':sum(x['bytes'] for x in e['exports'])} for e in meta]))
