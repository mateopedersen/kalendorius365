import{filterPixels as s}from"./filters.js?v=371f2f4a1e12";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
