import{filterPixels as s}from"./filters.js?v=e3f6d5637c73";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
