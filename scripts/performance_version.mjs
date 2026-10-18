export function commonScriptFingerprint(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  const release = url.pathname.match(/\/assets\/releases\/([a-f0-9]{12,20})\/common\.js$/)?.[1];
  const legacy = url.pathname === '/assets/common.js' ? url.searchParams.get('v') : null;
  const value = release || legacy;
  return value && /^[a-f0-9]{12,20}$/.test(value) ? value.slice(0, 12) : null;
}
