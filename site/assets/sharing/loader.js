// The dialog, renderer, fonts and platform assets load only after a share click.
let dialog,latestRequest=0;
function current(){const el=document.getElementById('share-page-data');if(!el)throw new Error('share_data');return JSON.parse(el.textContent);}
async function serverDate(path){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),1800);try{const response=await fetch(path,{method:'HEAD',cache:'no-store',signal:controller.signal});const value=response.headers.get('date');return value?new Date(value):null;}finally{clearTimeout(timeout);}}
document.addEventListener('click',async event=>{
 const action=event.target.closest('[data-share-open],[data-share-key],[data-share-site]');if(!action)return;
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();const request=++latestRequest;action.setAttribute('aria-busy','true');
 try{
  dialog||=import('./dialog.js').catch(error=>{dialog=null;throw error;});const api=await dialog;
  const key=action.hasAttribute('data-share-site')?'site':action.dataset.shareKey;let record=key?null:current();
  if(key){if(!/^[a-z0-9-]{1,140}$/.test(key))throw new Error('share_key');const response=await fetch(`/assets/sharing/records/${key}.json`,{cache:'no-cache'});if(!response.ok)throw new Error('share_fetch');record=await response.json();}
  let serverNow=null;try{const u=new URL(record.canonicalUrl);if(u.origin==='https://kalendorius365.lt')serverNow=await serverDate(u.pathname);}catch{}
  if(request!==latestRequest)return;
  await api.openShareDialog(record,action,{serverNow});
 }catch{
  if(request!==latestRequest)return;
  const details=action.closest('details');if(details){details.open=true;details.querySelector('summary')?.focus();}else if(action.href)location.assign(action.href);
 }finally{action.removeAttribute('aria-busy');}
});
