#!/usr/bin/env python3
"""Optional full-font WOFF2 preparation; original export TTFs stay unchanged."""
from pathlib import Path
from fontTools.ttLib import TTFont
import hashlib,json
ROOT=Path(__file__).resolve().parents[1];rows=[]
for weight in ['Regular','Bold']:
 source=ROOT/f'site/assets/fonts/Inter-{weight}.ttf';target=source.with_name(f'Inter-{weight}-web.woff2');before=TTFont(source)
 if not target.exists():
  font=TTFont(source);font.recalcTimestamp=False;font.flavor='woff2';font.save(target)
 after=TTFont(target);assert set(before.getBestCmap())==set(after.getBestCmap())
 assert before['head'].unitsPerEm==after['head'].unitsPerEm
 for code,name in before.getBestCmap().items():
  other=after.getBestCmap()[code]
  a,b=before['glyf'][name],after['glyf'][other]
  assert a.getCoordinates(before['glyf'])==b.getCoordinates(after['glyf'])
  assert before['hmtx'][name]==after['hmtx'][other]
  assert getattr(a,'program',None)==getattr(b,'program',None)
 for tag in ['fpgm','prep','cvt ']:
  assert (tag in before)==(tag in after)
  if tag in before:assert before[tag].compile(before)==after[tag].compile(after)
 rows.append({'source':str(source.relative_to(ROOT)),'target':str(target.relative_to(ROOT)),'original_bytes':source.stat().st_size,'webfont_bytes':target.stat().st_size,'original_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'webfont_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'codepoints':len(before.getBestCmap()),'all_outlines_advances_and_hinting_identical':True})
(ROOT/'docs/performance/editor-webfonts.json').write_text(json.dumps({'method':'Full original Inter fonts compressed as WOFF2 for browser preview; original complete TTFs retained for embedded PDF, print and raster exports. Every mapped glyph, advance and hint verified.','fonts':rows},indent=2)+'\n');print(rows)
