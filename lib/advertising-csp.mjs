// Advertising exceptions apply only to known, public, query-free HTML pages.
export function advertisingCandidate(request, paths, hosts) {
  const url = new URL(request.url);
  return request.method === 'GET' && !url.search && hosts.includes(url.hostname) && paths.has(url.pathname);
}
export function advertisingCsp(original) {
  if (!original) return null; // Missing base policy must never grant an exception.
  const directives = new Map(original.split(';').map(part => part.trim().split(/\s+/)).filter(row => row[0]).map(([name, ...sources]) => [name, sources]));
  const scripts = directives.get('script-src');
  if (!scripts) return null;
  const grant = (name, sources) => directives.set(name, [...new Set([...(directives.get(name) || directives.get('default-src') || ["'none'"]).filter(value => value !== "'none'"), ...sources])]);
  directives.set('script-src', [...new Set([...scripts.filter(value => !/^'(?:sha(?:256|384|512)-|nonce-)/.test(value) && value !== "'none'"), "'unsafe-inline'", 'https://bauval.org'])]);
  // No separate script element policy may silently override this narrow grant.
  directives.delete('script-src-elem');
  directives.set('script-src-attr', ["'none'"]);
  grant('frame-src', ['https://bauval.org']);
  grant('connect-src', ['https://bauval.org']);
  grant('img-src', ['https://bauval.org', 'https://static.nresystems.com', 'https://cdn.storageimagedisplay.com']);
  return [...directives].map(([name, sources]) => [name, ...sources].join(' ')).join('; ');
}
export async function advertisingResponse(context, paths, hosts) {
  // Reject private routes, all queries and previews before reading any response body.
  const candidate = advertisingCandidate(context.request, paths, hosts);
  const response = await context.next();
  if (!candidate || response.status !== 200 || !/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type') || '')) return response;
  const policy = advertisingCsp(response.headers.get('Content-Security-Policy'));
  if (!policy || !(await response.clone().text()).includes('data-advertising-slot')) return response;
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', policy);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
