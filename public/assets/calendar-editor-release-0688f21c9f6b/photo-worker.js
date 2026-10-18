<<<<<<<< HEAD:public/assets/calendar-editor-release-81a1faa29264/photo-worker.js
import{filterPixels as s}from"./filters.js?v=10f4c8adbc28";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
========
import{filterPixels as s}from"./filters.js?v=0f32785ff175";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
>>>>>>>> origin/main:public/assets/calendar-editor-release-0688f21c9f6b/photo-worker.js
