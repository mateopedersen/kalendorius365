#!/usr/bin/env python3
"""Optional asset preparation (fonttools[woff] required); not a build dependency.

Keep original complete fonts for extended glyphs and printable assets.
"""
from fontTools.ttLib import TTFont
from fontTools import subset
from pathlib import Path
import json,hashlib
base=set(range(0x20,0x100))|set(map(ord,'ĄąČčĘęĖėĮįŠšŲųŪūŽž'))|set(range(0x2000,0x2070))|{0x20ac,0x2122,0x2190,0x2192,0x2212}
def ranges(codes):
 parts=[]
 for c in sorted(codes):
  if parts and c==parts[-1][1]+1:parts[-1][1]=c
  else:parts.append([c,c])
 return ','.join('U+%04X'%a+('-%04X'%b if a!=b else '')for a,b in parts)
faces=[];evidence=[]
for weight,n in [('Regular',400),('Bold',700),('Black',900)]:
 p=Path('site/assets/fonts')/f'Lato-{weight}.woff2';original=TTFont(p);cmap=original.getBestCmap();used=set(cmap)&base;extra=set(cmap)-base
 opts=subset.Options();opts.flavor='woff2';opts.layout_features=['*'];opts.name_IDs=['*'];opts.name_legacy=True;opts.name_languages=['*']
 f=TTFont(p);f.recalcTimestamp=False;sub=subset.Subsetter(options=opts);sub.populate(unicodes=used);sub.subset(f)
 out=p.with_name(f'Lato-{weight}-latin-lt.woff2');f.save(out)
 assert set(TTFont(out).getBestCmap())==used
 for source,codes in [(p,extra),(out,used)]:
  faces.append('@font-face{\n  font-family: Lato;\n  src: url("/assets/fonts/'+source.name+'") format("woff2");\n  font-style: normal;\n  font-weight: '+str(n)+';\n  font-display: swap;\n  unicode-range: '+ranges(codes)+';\n}\n')
 evidence.append({'weight':n,'original_bytes':p.stat().st_size,'latin_lithuanian_bytes':out.stat().st_size,'original_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'subset_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'original_codepoints':len(cmap),'initial_codepoints':len(used),'deferred_codepoints':len(extra),'all_original_characters_preserved':used|extra==set(cmap)})
p=Path('site/assets/design-system.css');s=p.read_text();start=s.index('@font-face');end=s.index(':root{');p.write_text(s[:start]+''.join(faces)+s[end:])
p=Path('site/_layouts/default.html');s=p.read_text().replace('fonts/Lato-Regular.woff2','fonts/Lato-Regular-latin-lt.woff2').replace('fonts/Lato-Black.woff2','fonts/Lato-Black-latin-lt.woff2');p.write_text(s)
Path('docs/performance/font-subsets.json').write_text(json.dumps({'method':'Disjoint Unicode ranges: Latin and Lithuanian first; every original extended glyph remains available on demand. Original print fonts unchanged.','fonttools_version':__import__('fontTools').version,'fonts':evidence},indent=2)+'\n')
print(evidence)
