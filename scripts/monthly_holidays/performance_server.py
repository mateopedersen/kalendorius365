"""Local-only cold-cache test server: shared 1 Mbit/s, 150 ms request latency.

Injects read-only performance observers into local HTML responses. This server
and its instrumentation are never used by the production deployment.
"""
from __future__ import annotations
import gzip,json,mimetypes,threading,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote,urlsplit
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[2]

PROBE='''<script>(()=>{
let lcp=null,cls=null,session=0,first=0,last=0;const shifts=[],resizes=[],width_start=innerWidth;
const supported=PerformanceObserver.supportedEntryTypes||[];
addEventListener('resize',()=>resizes.push({t:performance.now(),width:innerWidth,height:innerHeight}));
if(supported.includes('largest-contentful-paint'))new PerformanceObserver(list=>{for(const e of list.getEntries())lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
if(supported.includes('layout-shift')){cls=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){if(e.startTime-last>1000||e.startTime-first>5000){session=0;first=e.startTime}last=e.startTime;session+=e.value;cls=Math.max(cls,session);shifts.push({t:e.startTime,value:e.value,sources:(e.sources||[]).map(s=>({tag:s.node?.tagName,class:s.node?.className,previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))})}}).observe({type:'layout-shift',buffered:true})}
addEventListener('load',()=>setTimeout(()=>{const resources=performance.getEntriesByType('resource');const out=document.createElement('output');out.id='monthly-performance';out.hidden=true;out.textContent=JSON.stringify({supported,lcp_ms:lcp,cls,width_start,width_end:innerWidth,resizes,shifts,load_ms:performance.getEntriesByType('navigation')[0]?.loadEventEnd,transfer_bytes:resources.reduce((n,r)=>n+r.transferSize,0),full_resolution_downloads_loaded:resources.filter(r=>/downloads\\/.*\\.(?:pdf|webp)/.test(r.name)).map(r=>r.name),resource_count:resources.length});document.body.append(out)},1500));
})();</script>'''
lock=threading.Lock();next_byte=0.0
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global next_byte
        root=(ROOT/'public').resolve();path=(root/unquote(urlsplit(self.path).path).lstrip('/')).resolve()
        if not path.is_relative_to(root):self.send_error(403);return
        baseline=urlsplit(self.path).path=='/baseline/sventes/2027/'
        if baseline:path=root/'sventes/2027/index.html'
        if path.is_dir():path=path/'index.html'
        if not path.is_file():self.send_error(404);return
        data=subprocess.check_output(['git','show','8891cae:public/sventes/2027/index.html'],cwd=ROOT) if baseline else path.read_bytes();mime=mimetypes.guess_type(path)[0] or 'application/octet-stream'
        if path.suffix=='.html':data=data.replace(b'<head>',b'<head>'+PROBE.encode(),1)
        compressed=('gzip' in self.headers.get('Accept-Encoding','') and (mime.startswith('text/') or path.suffix in ('.js','.json','.svg')))
        if compressed:data=gzip.compress(data,compresslevel=6)
        time.sleep(.15);self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)))
        if compressed:self.send_header('Content-Encoding','gzip')
        self.end_headers()
        try:
            for start in range(0,len(data),16384):
                chunk=data[start:start+16384]
                with lock:
                    now=time.monotonic();scheduled=max(now,next_byte);next_byte=scheduled+len(chunk)/125000
                time.sleep(max(0,scheduled-time.monotonic()));self.wfile.write(chunk)
        except (BrokenPipeError,ConnectionResetError):pass
    def log_message(self,*args):pass

if __name__=='__main__':
    print('Local performance server: http://127.0.0.1:8820 (shared 1 Mbit/s, 150 ms latency)',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8820),Handler).serve_forever()
