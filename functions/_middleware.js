import paths from './advertising-routes.js';
import { advertisingResponse } from '../lib/advertising-csp.mjs';
const publicPaths = new Set(paths);
export const onRequest = context => advertisingResponse(context, publicPaths, ['kalendorius365.lt', 'www.kalendorius365.lt']);
