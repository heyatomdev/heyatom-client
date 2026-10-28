import { addImports, addPlugin, addServerHandler, createResolver, defineNuxtModule, useLogger } from '@nuxt/kit';
import { resolveUmamiOptions, type UmamiOptions, type UmamiPublicOptions } from './runtime/utils.js';

export type { UmamiEventData, UmamiOptions, UmamiPublicOptions } from './runtime/utils.js';
export type UmamiModuleOptions = Partial<UmamiOptions>;

declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    umami: UmamiPublicOptions;
  }
  interface RuntimeConfig {
    umami: { upstream: string };
  }
}

/** Self-hosted Umami behind a same-origin Nitro proxy. Config key: `umami`. */
export default defineNuxtModule<UmamiModuleOptions>({
  meta: { name: '@heyatom/client/nuxt', configKey: 'umami', compatibility: { nuxt: '>=4.0.0' } },
  setup(moduleOptions, nuxt) {
    const rc = nuxt.options.runtimeConfig as {
      umami?: { upstream?: string };
      public: { umami?: Partial<UmamiPublicOptions> };
    };
    const { upstream, ...pub } = resolveUmamiOptions(moduleOptions, nuxt.options.dev, {
      public: rc.public.umami,
      private: rc.umami,
    });
    rc.umami = { upstream };
    rc.public.umami = pub;
    if (pub.enabled && !pub.websiteId) {
      useLogger('@heyatom/client/nuxt').warn('umami.websiteId is empty: set it or NUXT_PUBLIC_UMAMI_WEBSITE_ID, nothing is tracked until then');
    }

    const { resolve } = createResolver(import.meta.url);
    nuxt.options.build.transpile.push(resolve('./runtime'));
    addPlugin(resolve('./runtime/plugin'));
    addImports({ name: 'useUmami', from: resolve('./runtime/composable') });
    // One catch-all under the prefix, so the allow-list decides and the rest of Umami
    // (dashboard, other APIs) is never reachable through the app's domain.
    addServerHandler({ route: `${pub.path}/**`, handler: resolve('./runtime/server/proxy') });
  },
});
