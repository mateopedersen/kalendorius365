import{filterPixels as s}from"./filters.js?v=b17e627e94fa";self.onmessage=({data:f})=>{const e=new Uint8ClampedArray(f.buffer);s(e,f.photo),self.postMessage(e.buffer,[e.buffer])};
