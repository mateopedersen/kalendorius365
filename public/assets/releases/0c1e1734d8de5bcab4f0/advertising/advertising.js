import{mountDisplayBanner as t}from"./display-runtime.js";const e=document.getElementById("advertising-config");let n;try{n=JSON.parse(e?.textContent||"null")}catch{}n&&t(n);
