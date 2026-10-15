"""Derive uniquely named static print faces and a Latin/Lithuanian UI subset from licensed Inter."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
p=Path(__file__).resolve().parents[1]/'site/assets/fonts'
for name,weight in [('Regular',400),('Bold',700)]:
 f=instantiateVariableFont(TTFont(p/'Inter-variable.ttf'),{'wght':weight,'opsz':14})
 names={1:'Inter',2:name,4:'Inter '+name,6:'Inter-'+name,16:'Inter',17:name}
 for record in f['name'].names:
  if record.nameID in names:record.string=names[record.nameID].encode(record.getEncoding())
 f['OS/2'].usWeightClass=weight
 if weight==700:f['OS/2'].fsSelection=(f['OS/2'].fsSelection|32)&~64;f['head'].macStyle|=1
 else:f['OS/2'].fsSelection=(f['OS/2'].fsSelection|64)&~32;f['head'].macStyle&=~1
 f.recalcTimestamp=False
 f['head'].modified=TTFont(p/'Inter-variable.ttf')['head'].modified
 f.save(p/f'Inter-{name}.ttf')
f=TTFont(p/'Inter-variable.ttf');options=subset.Options();options.flavor='woff2';s=subset.Subsetter(options=options);s.populate(unicodes=list(range(0x20,0x250))+list(range(0x1e00,0x1f00))+[0x2013,0x2014,0x2018,0x2019,0x201c,0x201d,0x2026,0x20ac]);s.subset(f);f.flavor='woff2';f.recalcTimestamp=False;f.save(p/'Inter-Regular.woff2')
assert TTFont(p/'Inter-Regular.ttf')['name'].getDebugName(6)!=TTFont(p/'Inter-Bold.ttf')['name'].getDebugName(6)
