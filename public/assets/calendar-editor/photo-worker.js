import{filterPixels as s}from"./filters.js?v=c8cd0ab7d4d2";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
