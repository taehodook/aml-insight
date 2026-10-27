import {handle} from '../lib/platform.js';
export const onRequest = context => handle(context.request, context.env);
