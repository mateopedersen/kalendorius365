#!/usr/bin/env python3
"""Optional SVG asset preparation with fonttools[woff]; no build dependency.

Embed only the existing illustration's characters. Preserve the original font
outlines, advances, hinting, OpenType features, SVG text and scalable geometry.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
import xml.etree.ElementTree as ET
import re,io,json,hashlib,base64
ROOT=Path(__file__).resolve().parents[1]
page=ROOT/'site/kontaktai/index.html'
original_path=ROOT/'docs/performance/contact-art-original.svg'
pattern=r'<svg\b(?=[^>]*aria-labelledby="contact-art-title contact-art-desc")[\s\S]*?</svg>'
if not original_path.exists():original_path.write_text(re.search(pattern,page.read_text()).group()+'\n')
original=original_path.read_text().strip();characters={400:set(),700:set(),900:set()}
def visit(node,weight=400):
 weight=int(node.attrib.get('font-weight',weight))
 if node.tag=='text':characters[weight].update(map(ord,''.join(node.itertext())))
 for child in node:visit(child,weight)
visit(ET.fromstring(original));faces=[];proof=[]
for weight,label in [(400,'Regular'),(700,'Bold'),(900,'Black')]:
 source=ROOT/f'site/assets/fonts/Lato-{label}.woff2';before=TTFont(source);used=characters[weight];assert used<=set(before.getBestCmap())
 font=TTFont(source);font.recalcTimestamp=False
 options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=[0,1,2,3,4,5,6,13,14];options.name_legacy=True;options.name_languages=['*']
 sub=subset.Subsetter(options=options);sub.populate(unicodes=used);sub.subset(font)
 buffer=io.BytesIO();font.save(buffer);data=buffer.getvalue();after=TTFont(io.BytesIO(data));assert set(after.getBestCmap())==used
 a,b=before.getGlyphSet(),after.getGlyphSet()
 for code in used:
  old,new=before.getBestCmap()[code],after.getBestCmap()[code]
  pa,pb=DecomposingRecordingPen(a),DecomposingRecordingPen(b);a[old].draw(pa);b[new].draw(pb)
  assert pa.value==pb.value and before['hmtx'][old]==after['hmtx'][new]
  assert getattr(before['glyf'][old],'program',None)==getattr(after['glyf'][new],'program',None)
 faces.append('@font-face{font-family:K365ContactArt;src:url(data:font/woff2;base64,'+base64.b64encode(data).decode()+') format("woff2");font-weight:'+str(weight)+';font-style:normal;font-display:block}')
 proof.append({'weight':weight,'characters':''.join(chr(c)for c in sorted(used)),'codepoints':len(used),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'original_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outlines_advances_hinting_identical':True})
optimized=original.replace('</desc>','</desc><style data-contact-art-fonts>'+''.join(faces)+'</style>',1).replace('font-family="Lato,','font-family="K365ContactArt,Lato,')
text,count=re.subn(pattern,lambda _:optimized,page.read_text());assert count==1;page.write_text(text)
(ROOT/'docs/performance/contact-art-fonts.json').write_text(json.dumps({'method':'Exact original Lato glyph outlines, advances, hinting and OpenType features for existing SVG text; smaller embedded per-weight subsets avoid three font round trips. Original complete fonts and illustration retained.','fonttools_version':__import__('fontTools').version,'original_svg_sha256':hashlib.sha256(original_path.read_bytes()).hexdigest(),'fonts':proof},ensure_ascii=False,indent=2)+'\n')
print('Embedded',sum(r['bytes']for r in proof),'font bytes for',sum(r['codepoints']for r in proof),'existing decorative characters')
