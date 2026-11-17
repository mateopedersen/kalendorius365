// A first-party sponsored link needs no additional script, frame or connection permission.
export function advertisingCandidate(request,paths,hosts){const url=new URL(request.url);return request.method==='GET'&&!url.search&&hosts.includes(url.hostname)&&paths.has(url.pathname);}
export function advertisingCsp(original){return original;}
export async function advertisingResponse(context){return context.next();}
