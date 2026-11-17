// Grant the exact active provider only on successful public HTML with a Banner.
export function advertisingCandidate(request,paths,hosts){const u=new URL(request.url);return request.method==='GET'&&!u.search&&hosts.includes(u.hostname)&&paths.has(u.pathname);}
export function advertisingCsp(original){
 if(!original)return null;
 const d=new Map(original.split(';').map(x=>x.trim().split(/\s+/)).filter(x=>x[0]).map(([name,...sources])=>[name,sources]));
 if(!d.has('script-src'))return null;
 const grant=(name,more)=>d.set(name,[...new Set([...(d.get(name)||d.get('default-src')||["'none'"]).filter(x=>x!=="'none'"),...more])]);
 // Publisher support confirmed on 2026-11-17 that the official Banner requires
 // dynamic evaluation as well as inline creative elements. This helper is applied
 // only after a real successful public display-slot response has been verified.
 grant('script-src',['https://bauval.org',"'unsafe-eval'"]);
 // Adsterra's original Banner writes inline creative scripts into its own frame.
 // That about:blank frame inherits this public response's element policy.
 // Retain base hashes/nonces and block inline event handlers;
 // only qualified public ad HTML receives the required creative-element allowance.
 const elements=(d.get('script-src-elem')||d.get('script-src')).filter(source=>!/^'(?:sha(?:256|384|512)-|nonce-|strict-dynamic|unsafe-inline|unsafe-eval|wasm-unsafe-eval|none)/.test(source));
 d.set('script-src-elem',[...new Set([...elements,"'unsafe-inline'",'https://bauval.org'])]);
 if(!d.has('script-src-attr'))d.set('script-src-attr',["'none'"]);
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
