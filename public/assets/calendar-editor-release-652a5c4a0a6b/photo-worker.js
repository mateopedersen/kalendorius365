import{filterPixels as s}from"./filters.js?v=1bfe0da5e827";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
