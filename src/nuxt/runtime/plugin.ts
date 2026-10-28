import { defineNuxtPlugin, useHead, useRuntimeConfig } from '#app';
import { umamiScripts, type UmamiPublicOptions } from './utils.js';

export default defineNuxtPlugin({
  name: 'heyatom-umami',
  setup() {
    const script = umamiScripts(useRuntimeConfig().public.umami as UmamiPublicOptions);
    if (script.length) useHead({ script: script as never[] /* plain attribute maps, unhead's union is stricter */ });
  },
});
