import { defineNuxtPlugin, useHead, useRuntimeConfig } from '#app';
import { umamiScripts, type UmamiPublicOptions } from './utils.js';

/** `path` is baked in at build time (generated template), like the server route. */
export default function createUmamiPlugin(path: string) {
  return defineNuxtPlugin({
    name: 'heyatom-umami',
    setup() {
      const script = umamiScripts(useRuntimeConfig().public.umami as UmamiPublicOptions, path);
      if (script.length) useHead({ script });
    },
  });
}
