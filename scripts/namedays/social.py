"""Optional OG artwork rebuild; output uses outlined, real Lato glyphs."""
from pathlib import Path
import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT=Path(__file__).resolve().parents[2]
font=TTFont(ROOT/'site/assets/fonts/Lato-Black.ttf')
glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); units=font['head'].unitsPerEm
parts=[]
for text,x,y,size in [('Vardadieniai',65,233,70),('Vardai. Datos. Dėmesys.',65,300,33),('Kalendorius 365',65,535,24)]:
    offset=0; paths=[]
    for char in text:
        glyph=cmap[ord(char)]; pen=SVGPathPen(glyphs); glyphs[glyph].draw(pen)
        paths.append(f'<g transform="translate({offset} 0)"><path d="{pen.getCommands()}"/></g>')
        offset+=font['hmtx'][glyph][0]
    parts.append(f'<g transform="translate({x} {y}) scale({size/units} {-size/units})" fill="#214833">'+''.join(paths)+'</g>')
hero=(ROOT/'site/assets/visuals/namedays/hero.svg').read_text()
hero=re.sub(r'<svg[^>]*>','',hero,1).removesuffix('</svg>')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f3f6ed"/><path d="M65 355H548" stroke="#bfa570"/>'+''.join(parts)+f'<g transform="translate(620 90)">{hero}</g></svg>'
(ROOT/'scripts/namedays/vardadieniai-1200x630.svg').write_text(svg)
print('Outlined Lato social master ready')
