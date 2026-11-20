"""Independent HTML language, calendar, download and semantic checks."""
import calendar,csv,hashlib,json,re
from html.parser import HTMLParser
from urllib.parse import urlsplit
from core import ROOT,GENITIVE,SLUGS,SOCIAL_IMAGE

class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.elements=[];self.text=[];self.skip=0;self.in_lunar=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);self.elements.append((tag,a))
        if tag=='div' and 'lunar-app' in a.get('class','').split():self.in_lunar=True
        if tag in ('script','style'):self.skip+=1
    def handle_endtag(self,tag):
        if tag in ('script','style'):self.skip-=1
    def handle_data(self,text):
        if self.in_lunar and not self.skip:self.text.append(text)

def main():
    routes=json.loads((ROOT/'docs/lunar/qa/browser-targets.json').read_text())
    requested=list(csv.DictReader((ROOT/'data/lunar/requested-months.csv').open()))
    requested={r['page_url'].replace('https://kalendorius365.lt',''):r for r in requested}
    routes.append('/menulio-kalendorius/2030/')
    for month, slug in enumerate(SLUGS, 1):
        route=f'/menulio-kalendorius/2030/{slug}/'
        routes.append(route)
        requested[route]={'year':2030,'month_number':month}
    data=json.loads((ROOT/'data/lunar/calendar.json').read_text())
    results=[]
    for route in routes:
        path=ROOT/'public'/route.lstrip('/')/'index.html';raw=path.read_text();p=Page();p.feed(raw)
        elements=p.elements;text=' '.join(p.text)
        assert sum(t=='h1' for t,a in elements)==1,route
        assert any(t=='html' and a.get('lang')=='lt' for t,a in elements),route
        assert any(t=='link' and a.get('rel')=='canonical' and a.get('href')=='https://kalendorius365.lt'+route for t,a in elements),route
        assert not re.search(r'\b(Moon|New Moon|Full Moon|First Quarter|Last Quarter|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b',text,re.I),(route,'English visible text')
        assert not re.search(r'\d+\.\d+\s*%',text),(route,'Decimal point')
        assert SOCIAL_IMAGE in raw and (ROOT/'public'/SOCIAL_IMAGE.lstrip('/')).is_file(),route
        if route=='/menulio-fazes/':
            year_links={a['data-phase-year']:a['href'] for t,a in elements if t=='a' and 'data-phase-year' in a}
            assert year_links=={str(year):f'/menulio-kalendorius/{year}/' for year in range(2027,2031)},route
            assert [a.get('data-slug') for t,a in elements if t=='option' and 'data-slug' in a]==SLUGS,route
        for t,a in elements:
            if t=='img':assert 'alt' in a,(route,a)
        row=requested.get(route)
        days=0
        if row:
            year=int(row['year']);month=int(row['month_number']);days=calendar.monthrange(year,month)[1]
            dates=[a['data-lunar-date'] for t,a in elements if 'data-lunar-date' in a]
            assert dates==[f'{year}-{month:02}-{day:02}' for day in range(1,days+1)],route
            assert GENITIVE[month-1] in text
            downloads={urlsplit(a.get('href','')).path for t,a in elements if t=='a' and 'download' in a and urlsplit(a.get('href','')).path.endswith(('.pdf','.webp'))}
            expected_downloads={urlsplit(row[k]).path for k in ('dark_pdf','dark_webp','light_pdf','light_webp') if k in row}
            assert downloads==expected_downloads,route
            if year==2030:
                assert any(t=='button' and 'data-print' in a for t,a in elements),route
                assert all((ROOT/'public/assets/lunar/days'/f'{day}.webp').is_file() for day in dates),route
            events=[e for e in data['events'] if e['local_date'].startswith(f'{year}-{month:02}')]
            assert len(events)==sum('data-event-ics' in a for t,a in elements),route
            for e in events:assert e['local_label_lt'] in raw,route
        results.append({'route':route,'status':'passed','days':days,'html_sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    report={'status':'passed','pages':len(results),'method':'Independent HTML parser: visible Lithuanian text, decimal commas, document language, H1, canonical, OG, all dates, exact requested downloads and local primary moments. Editorial review is recorded separately.','results':results}
    (ROOT/'docs/lunar/qa/pages-language-semantics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(f'Lunar HTML language and semantic checks passed for all {len(results)} pages.')

if __name__=='__main__':main()
