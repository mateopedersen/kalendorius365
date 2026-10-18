#!/usr/bin/env python3
"""Inline complete, conservatively pruned route CSS into generated HTML.

This removes the stylesheet round trip without hiding content or changing the
cascade. Runtime/lazy-import classes, preference classes and alternate states
remain available. Print media rules and original downloadable assets are kept.
"""
from __future__ import annotations
import html
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import urlsplit, unquote
from css_route_split import filter_css

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
BUNDLE_SOURCES = {
 'homepage-bundle.css': ('style.css','design-system.css','homepage.css'),
 'horoscope-detail.css': ('style.css','design-system.css','horoscope.css','zodiac.css'),
 'horoscope-hub.css': ('style.css','design-system.css','horoscope.css','zodiac.css'),
 'zodiac-guide.css': ('style.css','design-system.css','horoscope.css','zodiac.css'),
}

class Context(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.classes=set();self.styles=[];self.scripts=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.classes.update(a.get('class','').split())
  if tag=='link' and a.get('rel')=='stylesheet' and a.get('media','all') in ('all','screen',''):self.styles.append(a.get('href',''))
  if tag=='script' and a.get('src'):self.scripts.append(a['src'])

IMPORTS=re.compile(r'''(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+\.js(?:\?[^"']*)?)["']''')

def local_file(url, relative_to=PUBLIC):
 parsed=urlsplit(url)
 if parsed.scheme or parsed.netloc:return None
 path=(PUBLIC / unquote(parsed.path).lstrip('/')) if parsed.path.startswith('/') else relative_to / unquote(parsed.path)
 path=path.resolve()
 return path if path.is_relative_to(PUBLIC.resolve()) and path.is_file() else None

def runtime_classes(scripts,known):
 pending=[local_file(url) for url in scripts];seen=set();found=set()
 while pending:
  path=pending.pop()
  if path is None or path in seen:continue
  seen.add(path);source=path.read_text()
  # Scan whole source tokens conservatively. A string-only regex can lose its
  # place on JS regex literals or nested template literals and omit UI states.
  found.update(set(re.findall(r'[A-Za-z_][\w-]*',source)) & known)
  for prefix in re.findall(r'([A-Za-z_][\w-]*)\$\{',source):
   found.update(name for name in known if name.startswith(prefix))
  # Older UI helpers also concatenate suffixes, e.g. "dot cat" + index.
  for prefix in re.findall(r'''["'][^"'\n]*?([A-Za-z_][\w-]*)["']\s*\+''',source):
   found.update(name for name in known if name.startswith(prefix))
  for url in IMPORTS.findall(source):pending.append(local_file(url,path.parent))
 return found

def inline_page(path, css_cache, runtime_cache, prepared_cache=None, filtered_cache=None):
 if prepared_cache is None:prepared_cache={}
 if filtered_cache is None:filtered_cache={}
 source=path.read_text();context=Context();context.feed(source)
 paths=[]
 for url in context.styles:
  css_path=local_file(url)
  if css_path is None:continue
  if css_path.name in BUNDLE_SOURCES:
   paths.extend(PUBLIC/'assets'/name for name in BUNDLE_SOURCES[css_path.name])
  else:paths.append(css_path)
 if not paths:return None
 # Deduplicate only identical source files; retain their original cascade order.
 paths=tuple(dict.fromkeys(paths))
 if paths not in prepared_cache:
  css='\n'.join(css_cache[p] for p in paths)
  prepared_cache[paths]=(css,set(re.findall(r'\.([A-Za-z_][\w-]*)',css)))
 css,known=prepared_cache[paths]
 key=(tuple(context.scripts),frozenset(known))
 if key not in runtime_cache:runtime_cache[key]=runtime_classes(context.scripts,known)
 available=context.classes|runtime_cache[key]|{'large-text','high-contrast'}
 filter_key=(paths,frozenset(available & known))
 if filter_key not in filtered_cache:filtered_cache[filter_key]=filter_css(css,available)
 filtered=filtered_cache[filter_key]
 if '</style' in filtered.lower():raise ValueError('Unsafe HTML delimiter in CSS')
 sources=' '.join(context.styles)
 style='<style data-route-css="'+html.escape(sources,quote=True)+'">'+filtered+'</style>'
 inserted=False
 def replace_link(match):
  nonlocal inserted
  tag=match.group(0);p=Context();p.feed(tag)
  if p.styles and local_file(p.styles[0]) is not None:
   if inserted:return ''
   inserted=True;return style
  if re.search(r'''\brel=["']preload["']''',tag)and re.search(r'''\bas=["']style["']''',tag):
   return ''
  return tag
 updated=re.sub(r'<link\b[^>]*>',replace_link,source,flags=re.I)
 if not inserted:raise ValueError('No stylesheet insertion point in '+str(path))
 path.write_text(updated)
 return {'path':path.relative_to(PUBLIC).as_posix(),'source_bytes':len(css.encode()),'route_bytes':len(filtered.encode()),'stylesheet_requests_removed':len(context.styles)}

def main():
 css_cache={p:p.read_text()for p in (PUBLIC/'assets').rglob('*.css')}
 runtime_cache={};prepared_cache={};filtered_cache={};rows=[]
 for path in sorted(PUBLIC.rglob('*.html')):
  row=inline_page(path,css_cache,runtime_cache,prepared_cache,filtered_cache)
  if row:rows.append(row)
 import json
 output=ROOT/'docs/performance/route-css-sizes.json';output.parent.mkdir(exist_ok=True)
 output.write_text(json.dumps({'pages':len(rows),'method':'Full-route CSS with runtime classes and print rules; no hidden content','results':rows},ensure_ascii=False,indent=2)+'\n')
 print(f'Inlined route CSS on {len(rows)} pages; removed {sum(row["stylesheet_requests_removed"]for row in rows)} blocking stylesheet requests')
if __name__=='__main__':main()
