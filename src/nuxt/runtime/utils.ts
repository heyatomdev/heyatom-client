// Pure helpers shared by the module (build time), the plugin and the Nitro proxy.
// No imports: this file runs in Node, Nitro and the browser.

export interface UmamiOptions {
  /** Umami website id. Required: without it nothing is injected. */
  websiteId: string;
  /** Umami base URL as the Nitro server reaches it. Server-only. Default `http://umami:3000`. */
  upstream: string;
  /** Same-origin prefix of the proxy. Build time: the server route is mounted on it. Default `/_u`. */
  path: string;
  /** Hostnames that track (`data-domains`); empty = every host. */
  domains: string[];
  /** Strip `#hash` from tracked URLs. Default `true`. */
  excludeHash: boolean;
  /** Strip `?search` from tracked URLs. Default `false`, so utm/ref attribution works. */
  excludeSearch: boolean;
  /** Paths whose page views are not sent. Exact paths, `*` matches any characters. */
  ignore: string[];
  /** Inject the tracker and serve the proxy. Default: `true` in production builds only. */
  enabled: boolean;
}

export type UmamiPublicOptions = Omit<UmamiOptions, 'upstream'>;

export type UmamiEventData = { [key: string]: UmamiEventValue };
export type UmamiEventValue = boolean | number | string | null | UmamiEventData | UmamiEventValue[];

export const UMAMI_DEFAULTS: Omit<UmamiOptions, 'enabled'> = {
  websiteId: '',
  upstream: 'http://umami:3000',
  path: '/_u',
  domains: [],
  excludeHash: true,
  excludeSearch: false,
  ignore: [],
};

/** Name of the global `data-before-send` callback that drops ignored page views. */
export const BEFORE_SEND = '__heyatomUmamiBeforeSend';

/** Upper bound for a proxied `/api/send` body; tracker payloads are a few hundred bytes. */
export const UMAMI_MAX_BODY = 64 * 1024;

/** Arrays from config, or comma lists from env (`NUXT_PUBLIC_UMAMI_DOMAINS=a.com,b.com`). */
export function toList(v: unknown): string[] {
  const items = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return items.map((s) => String(s).trim()).filter(Boolean);
}

export function normalizePath(p: string): string {
  return '/' + p.replace(/^\/+|\/+$/g, '');
}

/**
 * Module options merged over defaults, then anything already set under `runtimeConfig.umami`
 * / `runtimeConfig.public.umami` in nuxt.config wins. Env overrides apply later, at runtime.
 */
export function resolveUmamiOptions(
  moduleOptions: Partial<UmamiOptions>,
  dev: boolean,
  runtime: { public?: Partial<UmamiPublicOptions>; private?: { upstream?: string } } = {},
): UmamiOptions {
  const defined = <T extends object>(o: T | undefined) =>
    Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;
  const o: UmamiOptions = {
    ...UMAMI_DEFAULTS,
    enabled: !dev,
    ...defined(moduleOptions),
    ...defined(runtime.public),
    ...defined(runtime.private),
  };
  return {
    ...o,
    path: normalizePath(o.path),
    upstream: o.upstream.replace(/\/+$/, ''),
    domains: toList(o.domains),
    ignore: toList(o.ignore),
  };
}

/** `^(?:…)/?$` over the pathname; `*` matches anything, everything else is literal. */
export function ignoreRegex(patterns: string[]): string {
  const alts = patterns.map((p) =>
    p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('.*').replace(/(?:\\\/)+$/, ''),
  );
  return `^(?:${alts.join('|')})\\/?$`;
}

type HeadScript = Record<string, string | boolean>;

/** The `<script>` tags for `useHead`. Empty when disabled or without a website id. */
export function umamiScripts(raw: UmamiPublicOptions): HeadScript[] {
  const c = { ...raw, path: normalizePath(raw.path ?? UMAMI_DEFAULTS.path), domains: toList(raw.domains), ignore: toList(raw.ignore) };
  if (!c.enabled || !c.websiteId) return [];
  const tracker: HeadScript = {
    src: `${c.path}/s.js`,
    defer: true,
    'data-website-id': c.websiteId,
    'data-host-url': c.path,
    'data-exclude-hash': String(c.excludeHash !== false),
    'data-exclude-search': String(c.excludeSearch === true),
  };
  if (c.domains.length) tracker['data-domains'] = c.domains.join(',');
  if (!c.ignore.length) return [tracker];
  tracker['data-before-send'] = BEFORE_SEND;
  // Inline, so it exists before the deferred tracker sends the first page view.
  // Page views and performance payloads carry no `name`; custom events always do.
  const re = JSON.stringify(ignoreRegex(c.ignore)).replace(/</g, '\\u003c');
  const inline = `window.${BEFORE_SEND}=function(t,p){try{if(p&&!p.name&&new RegExp(${re}).test(new URL(p.url,location.href).pathname))return null}catch(e){}return p}`;
  return [{ innerHTML: inline }, tracker];
}

/** Proxy allow-list: the upstream path for a request, or `null` (→ 404). */
export function upstreamPath(method: string, url: string, prefix: string): '/s.js' | '/api/send' | null {
  const path = url.split('?')[0];
  const p = normalizePath(prefix);
  if (method === 'GET' && path === `${p}/s.js`) return '/s.js';
  if (method === 'POST' && path === `${p}/api/send`) return '/api/send';
  return null;
}

/** Visitor IP: `CF-Connecting-IP`, then `X-Real-IP` (set by the proxy in front), then the socket. */
export function pickClientIp(header: (name: string) => string | undefined, socket?: string): string | undefined {
  for (const v of [header('cf-connecting-ip'), header('x-real-ip'), socket]) {
    if (v?.trim()) return v.trim();
  }
  return undefined;
}
