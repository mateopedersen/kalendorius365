import{filterPixels as s}from"./filters.js?v=7e412b98d5a7";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
