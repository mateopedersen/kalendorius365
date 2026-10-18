import {filterPixels} from "./filters.js";
self.onmessage=({data})=>{const bytes=new Uint8ClampedArray(data.buffer);filterPixels(bytes,data.photo);self.postMessage(bytes.buffer,[bytes.buffer]);};
