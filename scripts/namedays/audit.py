#!/usr/bin/env python3
"""Independent offline gate: Python calendar/HTML/XML, no importer helpers."""
from pathlib import Path
import calendar
import collections
import csv
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
import re
import unicodedata
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]

class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.parts=[];self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag=='sup':self.skip+=1
    def handle_endtag(self,tag):
        if tag=='sup':self.skip-=1
        if tag in ('li','p'):self.parts.append('\n')
    def handle_data(self,data):
        if not self.skip:self.parts.append(data)

class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.h1=0;self.canon=[];self.robots=[];self.lang=None;self.days=[];self.ids=[];self.namedays_assets=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id'in a:self.ids.append(a['id'])
        if tag=='h1':self.h1+=1
        if tag=='html':self.lang=a.get('lang')
        if tag=='link' and a.get('rel')=='canonical':self.canon.append(a['href'])
        if tag=='meta' and a.get('name')=='robots':self.robots.append(a['content'])
        if 'data-day'in a:self.days.append(a['data-day'])

def main():
    data=json.loads((ROOT/'data/namedays/cc-by-sa-4.0/snapshot.json').read_text())
    rows=data['records'];expected=[f'{m:02}-{d:02}' for m in range(1,13) for d in range(1,calendar.monthrange(2028,m)[1]+1)]
    assert [r['date']for r in rows]==expected
    names=collections.defaultdict(list);qa=[]
    for row in rows:
        assert row['source_revision_id']>0 and str(row['source_revision_id'])in row['source_revision']
        assert row['source_page'].startswith('https://lt.wikipedia.org/wiki/')
        assert row['license']=='CC-BY-SA-4.0'
        assert hashlib.sha256(row['source_section_html'].encode()).hexdigest()==row['section_sha256']
        parser=Text();parser.feed(row['source_section_html']);text=''.join(parser.parts)
        independent=[]
        for n in re.findall(r"[^\W\d_]+(?:[-’'][^\W\d_]+)*",text,flags=re.UNICODE):
            n=unicodedata.normalize('NFC',n)
            assert n[0].isupper(),(row['date'],n)
            if n not in independent:independent.append(n)
        assert independent==row['names'],(row['date'],independent,row['names'])
        assert len(set(row['names']))==len(row['names']) and row['names']
        for n in row['names']:
            assert n==unicodedata.normalize('NFC',n) and '\ufffd'not in n and '<'not in n
            names[n].append(row['date'])
        qa.append({'date':row['date'],'source':row['source_page'],'revision':row['source_revision_id'],
          'name_count':len(row['names']),'transforms':'; '.join(row['transforms']),
          'source_section_sha256':row['section_sha256'],'data_gate':'PASS','independent_python_extraction':'PASS'})
    assert rows[59]['date']=='02-29' and rows[59]['names']==['Gustis','Tolvaldas']
    assert len(rows[0]['names'])==11
    assert any(any(c in n for c in 'ąčęėįšųūž')for n in names)
    sitemap=(ROOT/'public/sitemap.xml').read_text()
    months=json.loads((ROOT/'site/assets/data/calendar.json').read_text())['months']
    routes=['/vardadieniai/']+[f'/vardadieniai/{m[0]}/'for m in months]
    pages=[]
    for index,route in enumerate(routes):
        raw=(ROOT/'public'/route.strip('/')/'index.html').read_text();p=Page();p.feed(raw)
        assert p.h1==1 and p.lang=='lt' and p.canon==['https://kalendorius365.lt'+route]
        assert p.robots==['index, follow'] and 'https://kalendorius365.lt'+route in sitemap
        assert len(set(p.ids))==len(p.ids),(route,'Duplicate IDs')
        assert 'CC BY-SA 4.0'in raw and 'cc-by-sa-4.0.json'in raw and 'bendraautoriai'in raw
        assert all(re.search(r'/assets/releases/[0-9a-f]{20}/namedays\.'+extension+r'(?:[\"\']|\s)',raw) for extension in ['js','css'])
        if index:
            rr=[r for r in rows if int(r['date'][:2])==index]
            assert p.days==[r['date']for r in rr]
            for row in rr:
                for n in row['names']:assert html.escape(n,quote=True)in raw
                assert html.escape(row['source_revision'],quote=True)in raw
        pages.append({'route':route,'static_day_groups':len(p.days),'status':'passed'})
    vectors=[]
    for p in sorted((ROOT/'site/assets/visuals/namedays').glob('*.svg')):
        svg=ET.fromstring(p.read_text());assert svg.attrib.get('viewBox')
        assert not list(svg.iter('{http://www.w3.org/2000/svg}script'))
        assert '<foreignObject'not in p.read_text() and p.stat().st_size<30000
        vectors.append(p.name)
    assert len(vectors)==13
    # Check true all-day endpoints and UTF-8 octet folding separately from Ruby.
    for r in rows:
        raw=(ROOT/f'site/assets/namedays-ics/{r["date"]}.ics').read_bytes()
        assert b'\n'not in raw.replace(b'\r\n',b'')
        assert all(len(line)<=75 for line in raw.split(b'\r\n'))
        s=raw.decode().replace('\r\n ',''); props=dict(line.split(':',1)for line in s.split('\r\n')if ':'in line)
        start=dt.datetime.strptime(props['DTSTART;VALUE=DATE'],'%Y%m%d').date()
        end=dt.datetime.strptime(props['DTEND;VALUE=DATE'],'%Y%m%d').date()
        assert end-start==dt.timedelta(days=1) and start.strftime('%m-%d')==r['date']
        assert props['RRULE']=='FREQ=YEARLY' and 'CC BY-SA 4.0'in props['DESCRIPTION']
    for year in (2027,2028,2029):
        for month in range(1,13):
            assert calendar.monthrange(year,month)[1]in (28,29,30,31)
    out=ROOT/'docs/namedays';out.mkdir(parents=True,exist_ok=True)
    samples=json.loads((out/'source-sample-60.json').read_text())if(out/'source-sample-60.json').exists()else{'checks':[]}
    sampled={r['date']for r in samples['checks']}
    browser={}
    for cycle in (1,2):
        path=out/f'browser-round{cycle}.json'
        browser[cycle]=json.loads(path.read_text())if path.exists()else[]
    for row in qa:
        route=f'/vardadieniai/{months[int(row["date"][:2])-1][0]}/'
        row['source_wikitext_sample']='PASS'if row['date']in sampled else 'NOT_SAMPLED; independent HTML extraction passed'
        row['license_review']='CC-BY-SA-4.0; attribution, changes and adapted dataset published'
        for cycle in (1,2):
            cases=[r for r in browser[cycle]if r['route']==route]
            passed=len(cases)==4 and all(not r['overflow']and not(r.get('axe')or{}).get('violations')for r in cases)
            row[f'browser_round_{cycle}']='PASS: 1440,768,390,360'if passed else 'PENDING'
    with (out/'DATE_SOURCE_QA.csv').open('w',newline='',encoding='utf-8')as f:
        writer=csv.DictWriter(f,fieldnames=list(qa[0]));writer.writeheader();writer.writerows(qa)
    report={'status':'passed','date_records':len(rows),'unique_names':len(names),
      'name_date_occurrences':sum(map(len,names.values())),'names_with_multiple_dates':sum(len(v)>1 for v in names.values()),
      'max_names_in_a_day':max(len(r['names'])for r in rows),'pages':pages,'original_svgs':vectors,
      'static_ics_checked':len(rows),'source_quality':'Faithful extraction of attributed community source; not official certification of traditions or every name spelling.'}
    (out/'offline-gates.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
