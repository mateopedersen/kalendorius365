// Grant the exact active provider only on successful public HTML with a Banner.
export function advertisingCandidate(request,paths,hosts){const u=new URL(request.url);return request.method==='GET'&&!u.search&&hosts.includes(u.hostname)&&paths.has(u.pathname);}
export function advertisingCsp(original){
 if(!original)return null;
 const d=new Map(original.split(';').map(x=>x.trim().split(/\s+/)).filter(x=>x[0]).map(([name,...sources])=>[name,sources]));
 if(!d.has('script-src'))return null;
 const grant=(name,more)=>d.set(name,[...new Set([...(d.get(name)||d.get('default-src')||["'none'"]).filter(x=>x!=="'none'"),...more])]);
 grant('script-src',['https://bauval.org']);if(d.has('script-src-elem'))grant('script-src-elem',['https://bauval.org']);
 grant('frame-src',['https://bauval.org']);grant('connect-src',['https://bauval.org']);
 grant('img-src',['https://bauval.org','https://static.nresystems.com','https://cdn.storageimagedisplay.com']);
 return [...d].map(([name,...rest])=>[name,...rest.flat()].join(' ')).join('; ');
}
export async function advertisingResponse(context,paths,hosts){
 const candidate=advertisingCandidate(context.request,paths,hosts),response=await context.next();
 if(!candidate||response.status!==200||!/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type')||''))return response;
 const policy=advertisingCsp(response.headers.get('Content-Security-Policy'));
 if(!policy||!(await response.clone().text()).includes('data-advertising-mode="display-banner"'))return response;
 const headers=new Headers(response.headers);headers.set('Content-Security-Policy',policy);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
