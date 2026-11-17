import {mountDisplayBanner} from './display-runtime.js';
const node=document.getElementById('advertising-config');
let bannerConfig;try{bannerConfig=JSON.parse(node?.textContent||'null');}catch{}
if(bannerConfig)mountDisplayBanner(bannerConfig);
