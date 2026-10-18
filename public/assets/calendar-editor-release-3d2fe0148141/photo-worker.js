import{filterPixels as s}from"./filters.js?v=35d96e1bd831";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
