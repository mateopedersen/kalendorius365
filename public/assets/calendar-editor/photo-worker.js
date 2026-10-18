import{filterPixels as s}from"./filters.js?v=a92ec75a7a78";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
