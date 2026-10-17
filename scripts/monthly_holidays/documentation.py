"""Rebuild factual date, source and original-media ledgers from the reviewed registry."""
from pathlib import Path
import json,csv,hashlib,sys
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/2027-monthly-holidays';sys.path.insert(0,str(Path(__file__).parent))
from editorial import MONTH_NOTES
D=json.loads((ROOT/'data/monthly-holidays-2027.json').read_text());M=json.loads((ROOT/'data/monthly-holiday-media.json').read_text());months=json.loads((ROOT/'data/calendar.json').read_text())['months']
def write(name,fields,rows):
 with (OUT/name).open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
rows=[];sources=[]
for e in D['events']:
 slug=months[int(e['date'][5:7])-1][0];route='/sventes/2027/'+slug+'/'
 urls=' | '.join(D['sources'][s]['url'] for s in e['sources'])
 rows.append(dict(route=route,id=e['id'],date=e['date'],weekday=e['weekday_lt'],title_lt=e['title'],category=e['category'],statutory_nonworking=e['statutory_nonworking'],recurrence=json.dumps(e['recurrence'],ensure_ascii=False),legal_point=e.get('law_point',''),legal_version=e.get('law_version',''),sources=urls,reviewed_at='2026-10-17'))
 for sid in e['sources']:
  s=D['sources'][sid];sources.append(dict(route=route,claim_id=e['id'],claim_lt=e['title']+' — '+e['summary'],source_id=sid,primary_url=s['url'],publisher=s['publisher'],legal_version=s.get('version',''),rule=json.dumps(e['recurrence'],ensure_ascii=False),checked_at='2026-10-17',evidence=s.get('access','Primary source researched; supporting date/cultural claim, not permission to copy artwork.')))
for i,(_,intro,spots,q,a) in enumerate(MONTH_NOTES,1):
 route='/sventes/2027/'+months[i-1][0]+'/';eventmap={e['id']:e for e in D['events']}
 for eid,title,text in spots:
  e=eventmap[eid]
  for sid in e['sources']:
   s=D['sources'][sid];sources.append(dict(route=route,claim_id='spotlight-'+eid,claim_lt=title+' — '+text,source_id=sid,primary_url=s['url'],publisher=s['publisher'],legal_version=s.get('version',''),rule=json.dumps(e['recurrence'],ensure_ascii=False),checked_at='2026-10-17',evidence='Editorial explanation cross-checked with event record, calendar and primary source; no scheduled public-event programme is asserted.'))
 # Cultural illustration context has its own provenance, separate from calendar law.
 ids={1:['tower','three-kings'],2:['spring'],3:['eggs','spring'],4:['spring','atvelykis'],5:['law'],6:['jonines'],7:['tower','dk'],8:['zoline'],9:['law'],10:['law'],11:['velines'],12:['straw','kucios']}[i]
 for sid in ids:
  s=D['sources'][sid];sources.append(dict(route=route,claim_id='original-art-context',claim_lt=M[i-1]['alt'],source_id=sid,primary_url=s['url'],publisher=s['publisher'],legal_version=s.get('version',''),rule='Original symbolic composition; no copied source paths or photographs.',checked_at='2026-10-17',evidence='Primary cultural context only. Artwork is original, stylized and not documentary.'))
write('verified-dates-and-classifications.csv',list(rows[0]),rows);write('sources-ledger.csv',list(sources[0]),sources)
assets=[]
for a in M:
 for role,key in [('original SVG','src'),('social PNG 1200x630','og'),('preview WebP 640x427','preview'),('thumbnail WebP 240x160','small_preview')]:
  p=ROOT/'site'/a[key].lstrip('/');assets.append(dict(month=a['month'],role=role,path=a[key],bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),alt_lt=a['alt'],authorship='Original Kalendorius365 project artwork',licensing='No stock images, copied vector paths, photographs or third-party artwork; code-native original SVG. Existing Lato font remains under its OFL.',source_context=' | '.join(s['primary_url'] for s in sources if s['route']=='/sventes/2027/'+months[a['month']-1][0]+'/' and s['claim_id']=='original-art-context')))
p=ROOT/'site/assets/visuals/2027-monthly-holidays/guide-icons.svg';assets.append(dict(month='all',role='10-symbol original SVG UI sprite',path='/assets/visuals/2027-monthly-holidays/guide-icons.svg',bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),alt_lt='Decorative symbols hidden from assistive technology; adjacent text labels the action.',authorship='Original Kalendorius365 project vector geometry',licensing='No third-party paths or icon library.',source_context='UI symbols do not assert cultural or historical authenticity.'))
write('original-media-ledger.csv',list(assets[0]),assets)
print(f'Wrote {len(rows)} date records, {len(sources)} source/claim relations and {len(assets)} original/derived media records.')
