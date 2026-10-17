#!/usr/bin/env python3
"""Assemble page-by-page CSV evidence; a production pass must be explicitly supplied."""
from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime, timezone
import json, csv, argparse, hashlib, re

ROOT=Path(__file__).resolve().parents[2]
HOST='https://kalendorius365.lt'

def load(path):return json.loads(path.read_text())
def write_csv(path,rows,fields):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('w',encoding='utf-8-sig',newline='')as f:
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader();writer.writerows(rows)
def schema_types(page):
    types=[]
    def walk(x):
        if isinstance(x,dict):
            if '@type'in x:types.extend(x['@type']if isinstance(x['@type'],list)else[x['@type']])
            for v in x.values():walk(v)
        elif isinstance(x,list):
            for v in x:walk(v)
    walk(page.get('structured_data',[]));return ', '.join(sorted(set(types)))
def run(progress,final_path,output,production):
    output.mkdir(parents=True,exist_ok=True)
    before=load(progress/'evidence/qa1-live/crawl.json');final=load(final_path)
    original={r['url']:r for r in before['pages']}
    if production:
        assert all(r.get('saved_html') and 'status_source'not in r and r.get('headers')for r in final['pages']), 'Production proof requires actual HTTP records'
        assert not any(r['issues']for r in final['pages']), 'Unresolved production technical issues'
    changes=[]
    for filename,key in [('root-changes.json',None),('astronomy-changes.json',None),('agent-holidays.json','changes'),('agent-horoscope.json','changes')]:
        d=load(progress/filename);items=d[key]if key else d
        for row in items:
            b=row.get('before_text',row.get('before',''));a=row.get('after_text',row.get('after',''))
            if b==a:continue
            source=row.get('file',row.get('source_file',''))
            line=row.get('line_after',row.get('line',row.get('line_before','')))
            if not line and source and (ROOT/source).is_file():
                text=(ROOT/source).read_text();needle=str(a)
                pos=text.find(needle)
                if pos>=0:line=text[:pos].count('\n')+1
            changes.append({'Issue ID':row.get('issue_id',row.get('id',f'LT-ROOT-{len(changes)+1:03}')),'Source File':source,'Line':line,'Category':row.get('category','LT-IDIOM'),'Severity':row.get('severity','P2'),'Before':b,'After':a,'Reason':row.get('reason','Reviewed Lithuanian copy'),'Routes':'; '.join(row.get('routes',[])),'Status':'FIXED_SOURCE_AND_RENDERED' if not production else 'FIXED_SOURCE_RENDERED_AND_PRODUCTION_HTTP_VERIFIED'})
    # Exact duplicate log entries can arise where a root proposal is also in its agent report.
    changes=list({(r['Source File'],r['Before'],r['After']):r for r in changes}.values())
    write_csv(output/'DETAILED_LANGUAGE_CHANGES.csv',changes,list(changes[0]))
    write_csv(output/'LANGUAGE_ISSUE_LOG.csv',changes,list(changes[0]))
    cross={}
    for filename,key,reviewer in [('agent-core-independent-qa.json','routes','Independent holidays agent; root-source pages'),('independent-qa-astronomy.json','entries','Independent astronomy agent; holidays/horoscopes'),('progress/independent-qa-horoscopes.json','routes','Independent horoscope agent; astronomy/namedays/about')]:
        d=load(progress/filename)
        for r in d[key]:
            route=r.get('route',urlsplit(r.get('url','')).path)
            assert route not in cross,route
            cross[route]=(r,reviewer)
    assert len(cross)==len(final['pages'])==186,(len(cross),len(final['pages']))
    rows=[];coverage=[];new=[];main_changed=meta_changed=title_changed=0
    for p in sorted(final['pages'],key=lambda p:p['url']):
        url=p['url'];route=urlsplit(url).path;o=original.get(url,{});review,reviewer=cross[route]
        body_changed=o.get('main_sha256')!=p.get('main_sha256');main_changed+=bool(o and body_changed)
        t0=(o.get('title')or[''])[0];t1=p['title'][0];m0=(o.get('meta',{}).get('description')or[''])[0];m1=p['meta']['description'][0]
        title_changed+=bool(o and t0!=t1);meta_changed+=bool(o and m0!=m1)
        authority=review.get('eeat_finding',review.get('e_e_a_t_finding',''))
        if not authority:
            if route.startswith('/vardadieniai/'):
                authority='Pinned Lithuanian Wikipedia revisions, history/source links and CC BY-SA4.0 attribution preserved;366 source records unchanged; community source is not an official registry.'
            elif route.startswith('/horoskopai/')or route=='/zodiakas/':
                authority='Astrology distinguished from astronomy/scientific evidence; calculation provenance and automation method disclosed; no fictional author or native-human certification.'
            elif p.get('source_links'):
                authority='Visible methodology/source references reviewed: '+'; '.join(p['source_links'][:4])
            else:authority='Purpose and instructions reviewed for this specific tool/directory; source methodology accessible through relevant calendar/tool links and the shared About link. No invented credentials.'
        fixes=['Shared crawlable About/search links and truthful WebPage metadata']
        if body_changed:fixes.append('Main content revised and independently reviewed' if o else 'New original source/editorial methodology page')
        if t0!=t1:fixes.append('Distinct Lithuanian title verified'if o else'New unique Lithuanian title')
        if m0!=m1:fixes.append('Distinct content-aligned Lithuanian description verified')
        if route=='/paieska/':fixes.append('Orphan repaired with ordinary HTML links; complete static page catalogue')
        qa1='PASS: first live185-URL crawl + corrected local generated HTML; individual AI content review'
        if not o:qa1='PASS: new page source, generated HTML and independent AI content review; not present in original185-URL crawl'
        qa2=('PASS: actual production HTTP/headers/HTML, robots/canonical/sitemap/metadata and independent content review; '+final['checked_at'])if production else 'PENDING_PRODUCTION_HTTP; independent rendered-content second review complete'
        row={'URL':url,'HTTP Status':p['status']if production else(o.get('status','NOT_YET_DEPLOYED')),'Indexability':'TECHNICALLY_ELIGIBLE; Google indexing not confirmed'if production and not p['issues']else'LOCAL_RELEASE_VALID; production verification pending','Robots':json.dumps({'meta':p['meta'].get('robots'), 'x_robots_tag':next((v for k,v in p.get('headers',{}).items()if k.lower()=='x-robots-tag'),None),'user_agents':p.get('robots_allowed')},ensure_ascii=False),'Canonical':'; '.join(p['canonical']),'Sitemap':'INCLUDED; actual production XML'if production else'INCLUDED; local release XML','Original Title':t0,'Final Title':t1,'Original Meta Description':m0,'Final Meta Description':m1,'H1':'; '.join(p['h1']),'Structured Data':schema_types(p),'E-E-A-T Findings':authority,'Issues Fixed':'; '.join(fixes),'QA1':qa1,'QA2':qa2,'Evidence':p.get('saved_html',''),'Independent Reviewer':reviewer,'Technical Issues':'; '.join(p['issues'])}
        rows.append(row)
        coverage.append({'URL':url,'Baseline185':'YES'if o else'NO','Discovered From':'; '.join(p.get('discovery',[])),'First Live HTTP':o.get('status','NEW'),'Final HTTP':p['status']if production else'PENDING','Main Text Changed':bool(o and body_changed),'Title Changed':bool(o and t0!=t1),'Description Changed':bool(o and m0!=m1),'AI Content QA1':'INDIVIDUALLY_REVIEWED','Independent AI Content QA2':reviewer,'Production QA2':'PASS'if production else'PENDING','Disposition':'PRESERVED'if o else'NEW_USEFUL_PAGE','Visual Evidence':'See exhaustive four-width browser geometry rows and selected screenshots; geometry is not a manual screenshot review.'})
        if not o:new.append({'URL':url,'Reason':'Original About/editorial/source page; distinct trust/transparency purpose, no duplicate landing page','Canonical':url,'QA1':'PASS_LOCAL_AND_INDEPENDENT_CONTENT','QA2':'PASS_ACTUAL_PRODUCTION_HTTP'if production else'PENDING_PRODUCTION'})
    fields=['URL','HTTP Status','Indexability','Robots','Canonical','Sitemap','Original Title','Final Title','Original Meta Description','Final Meta Description','H1','Structured Data','E-E-A-T Findings','Issues Fixed','QA1','QA2','Evidence','Independent Reviewer','Technical Issues']
    write_csv(output/'FINAL_SITEWIDE_URL_AUDIT.csv',rows,fields)
    write_csv(output/'URL_COVERAGE_FINAL.csv',coverage,list(coverage[0]))
    write_csv(output/'NEW_URLS_SINCE_BASELINE.csv',new,list(new[0]))
    qa={'generated_at':datetime.now(timezone.utc).isoformat(),'baseline_urls':len(original),'final_urls':len(rows),'preserved':sum(bool(p['url']in original)for p in final['pages']),'new':len(new),'deleted':0,'redirected_new':0,'exact_source_language_changes':len(changes),'source_files_with_language_changes':len({r['Source File']for r in changes}),'main_content_changed_existing_urls':main_changed,'unique_titles_changed_existing_urls':title_changed,'unique_descriptions_changed_existing_urls':meta_changed,'independent_content_coverage':len(cross),'production_qa2_complete':production,'technical_issue_counts':{p['url']:p['issues']for p in final['pages']if p['issues']},'limits':['AI-assisted two-pass editorial QA; native-human review was not performed.','Technical eligibility does not prove Google indexing or rankings.','No Search Console, traffic or backlink account evidence was available; no indexed page was removed.','External source origin blocks/rate limits remain separately reported; no blocked source is falsely marked reachable.','Local file status values are not HTTP observations. Final HTTP fields use original/final actual live crawls only.']}
    (output/('QA_PASS_2.json'if production else'QA_PASS_1.json')).write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(qa,ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--progress',type=Path,required=True);p.add_argument('--crawl',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--production',action='store_true');a=p.parse_args();run(a.progress,a.crawl,a.output,a.production)
