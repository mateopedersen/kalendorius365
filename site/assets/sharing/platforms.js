import {brandAssets} from './brand-assets.js';
import {graphemes,shorten,shareText,combinedText,publicUrl} from './model.js';
const stamp='2026-10-20';
const spec=(id,name,endpoint,docs,payload='url+text',method='intent')=>({id,name,endpoint,docs,payload,method,verifiedAt:stamp,requiresConfiguration:false,logo:brandAssets[id]?.localPath||null,brand:brandAssets[id]||null,documentationStatus:['facebook','instagram','threads','linkedin','reddit'].includes(id)?'official-reference-access-limited':'official-reference-reviewed',fallback:'copy-link',externalStatus:'composer-login-and-publishing-not-guaranteed'});
export const PLATFORMS=[
 spec('facebook','Facebook','https://www.facebook.com/sharer/sharer.php','https://developers.facebook.com/documentation/sharing/reference/share-dialog','url'),
 spec('x','X','https://x.com/intent/tweet','https://docs.x.com/x-for-websites/web-intents/overview'),
 spec('instagram','Instagram',null,'https://developers.facebook.com/documentation/instagram-platform/sharing-to-stories','file+caption','prepare'),
 spec('bluesky','Bluesky','https://bsky.app/intent/compose','https://bsky.network/docs/intent-links/'),
 spec('reddit','Reddit','https://www.reddit.com/submit','https://www.reddit.com/wiki/buttons/'),
 spec('whatsapp','WhatsApp','https://wa.me/','https://faq.whatsapp.com/5913398998672934'),
 spec('telegram','Telegram','https://t.me/share/url','https://core.telegram.org/widgets/share'),
 spec('threads','Threads','https://www.threads.com/intent/post','https://developers.facebook.com/documentation/threads/threads-web-intents'),
 spec('linkedin','LinkedIn','https://www.linkedin.com/sharing/share-offsite/','https://www.linkedin.com/developers/tools/plugins/share','url'),
 spec('pinterest','Pinterest','https://www.pinterest.com/pin/create/button/','https://developers.pinterest.com/docs/web-features/buttons/','url+public-image+text'),
 spec('mastodon','Mastodon','https://share.joinmastodon.org/','https://share.joinmastodon.org/'),
 spec('tumblr','Tumblr','https://www.tumblr.com/widgets/share/tool','https://help.tumblr.com/knowledge-base/share-button-documentation/'),
 spec('email','El. paštas','mailto:','https://www.rfc-editor.org/rfc/rfc6068','subject+body','mailto')
];
// Stable configuration, never visitor profiling. Instagram is always a preparation flow.
export const PRIMARY=['facebook','x','instagram'];
export function intentUrl(id,p,options={}){
 const item=PLATFORMS.find(x=>x.id===id);if(!item||item.method==='prepare')return null;
 const url=publicUrl(p.shareUrl),title=p.title;let text=shareText(p,options),all=`${text}\n${url}`;let query={};
 switch(id){
 case'facebook':query={u:url};break;
 case'x':query={text:shorten(shareText(p,{...options,short:true}),100),url};break; // Conservative budget: 100 graphemes + one weighted URL, no duplicated link.
 case'bluesky':{const budget=Math.max(1,299-graphemes(url).length);query={text:`${shorten(text,budget)}\n${url}`};break;}
 case'reddit':query={url,title:shorten(title,250)};break;
 case'whatsapp':case'threads':query={text:all};break;
 case'telegram':query={url,text};break;
 case'linkedin':query={url};break;
 case'pinterest':query={url,media:publicUrl(p.imageUrl),description:shorten(text,490)};break;
 case'mastodon':query={text:all};break;
 case'tumblr':query={canonicalUrl:url,posttype:'link',title,content:url,caption:text};break;
 case'email':query={subject:title,body:combinedText(p,options)};break;
 }
 const params=new URLSearchParams(query).toString();return item.endpoint+(item.method==='mailto'?'?':'?')+params;
}
