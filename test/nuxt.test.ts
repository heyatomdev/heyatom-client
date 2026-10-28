import { describe, expect, it } from 'vitest';
import {
  BEFORE_SEND,
  ignoreRegex,
  pickClientIp,
  resolveUmamiOptions,
  umamiScripts,
  upstreamPath,
} from '../src/nuxt/runtime/utils.js';

describe('resolveUmamiOptions', () => {
  it('applies defaults, enabled only outside dev', () => {
    expect(resolveUmamiOptions({ websiteId: 'w' }, false)).toEqual({
      websiteId: 'w',
      upstream: 'http://umami:3000',
      path: '/_u',
      domains: [],
      excludeHash: true,
      excludeSearch: false,
      ignore: [],
      enabled: true,
    });
    expect(resolveUmamiOptions({}, true).enabled).toBe(false);
  });

  it('runtimeConfig from nuxt.config wins over module options, undefined does not', () => {
    const o = resolveUmamiOptions(
      { websiteId: 'mod', path: 'stats/', upstream: 'http://x:1/', enabled: false },
      false,
      { public: { websiteId: 'rc', enabled: undefined }, private: { upstream: 'http://y:2' } },
    );
    expect(o).toMatchObject({ websiteId: 'rc', path: '/stats', upstream: 'http://y:2', enabled: false });
  });

  it('accepts comma lists for domains and ignore', () => {
    const o = resolveUmamiOptions({ domains: 'a.dev, b.dev' as never, ignore: ['/x', ' '] }, false);
    expect(o.domains).toEqual(['a.dev', 'b.dev']);
    expect(o.ignore).toEqual(['/x']);
  });
});

describe('pickClientIp', () => {
  const h = (m: Record<string, string>) => (n: string) => m[n];
  it('prefers CF-Connecting-IP, then X-Real-IP, then the socket', () => {
    expect(pickClientIp(h({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '2.2.2.2' }), '3.3.3.3')).toBe('1.1.1.1');
    expect(pickClientIp(h({ 'cf-connecting-ip': ' ', 'x-real-ip': '2.2.2.2' }), '3.3.3.3')).toBe('2.2.2.2');
    expect(pickClientIp(h({}), '3.3.3.3')).toBe('3.3.3.3');
    expect(pickClientIp(h({}))).toBeUndefined();
  });
});

describe('upstreamPath', () => {
  it('allows only the tracker script and the collect endpoint', () => {
    expect(upstreamPath('GET', '/_u/s.js', '/_u')).toBe('/s.js');
    expect(upstreamPath('GET', '/_u/s.js?v=1', '/_u')).toBe('/s.js');
    expect(upstreamPath('POST', '/_u/api/send', '/_u')).toBe('/api/send');
    for (const [m, p] of [
      ['POST', '/_u/s.js'],
      ['GET', '/_u/api/send'],
      ['GET', '/_u/'],
      ['GET', '/_u/login'],
      ['GET', '/_u/api/websites'],
      ['POST', '/_u/api/auth/login'],
      ['GET', '/_u/../s.js'],
      ['GET', '/_u/s.js/x'],
    ]) {
      expect(upstreamPath(m, p, '/_u'), `${m} ${p}`).toBeNull();
    }
  });
});

describe('ignoreRegex', () => {
  const re = (p: string[]) => new RegExp(ignoreRegex(p));
  it('matches exact paths, trailing slash optional, * as wildcard, the rest literal', () => {
    const r = re(['/auth/callback', '/admin/*', '/a.b']);
    expect(r.test('/auth/callback')).toBe(true);
    expect(r.test('/auth/callback/')).toBe(true);
    expect(r.test('/auth/callbackx')).toBe(false);
    expect(r.test('/x/auth/callback')).toBe(false);
    expect(r.test('/admin/users/1')).toBe(true);
    expect(r.test('/admin')).toBe(false);
    expect(r.test('/aXb')).toBe(false);
  });
});

describe('umamiScripts', () => {
  const base = { websiteId: 'w', path: '/_u', domains: [], excludeHash: true, excludeSearch: false, ignore: [], enabled: true };

  it('injects nothing when disabled or without a website id', () => {
    expect(umamiScripts({ ...base, enabled: false })).toEqual([]);
    expect(umamiScripts({ ...base, websiteId: '' })).toEqual([]);
  });

  it('builds the tracker tag on the same-origin prefix', () => {
    expect(umamiScripts({ ...base, domains: ['heyatom.dev', 'www.heyatom.dev'] })).toEqual([
      {
        src: '/_u/s.js',
        defer: true,
        'data-website-id': 'w',
        'data-host-url': '/_u',
        'data-exclude-hash': 'true',
        'data-exclude-search': 'false',
        'data-domains': 'heyatom.dev,www.heyatom.dev',
      },
    ]);
  });

  it('drops page views on ignored paths via before-send, keeps named events', () => {
    const [inline, tracker] = umamiScripts({ ...base, ignore: ['/auth/callback'] });
    expect(tracker['data-before-send']).toBe(BEFORE_SEND);
    const w: Record<string, (t: string, p: object) => unknown> = {};
    new Function('window', 'location', inline.innerHTML as string)(w, { href: 'https://x.dev/' });
    const send = w[BEFORE_SEND];
    expect(send('event', { url: 'https://x.dev/auth/callback?code=1' })).toBeNull();
    expect(send('event', { url: 'https://x.dev/auth/callback', name: 'login' })).not.toBeNull();
    expect(send('event', { url: 'https://x.dev/' })).not.toBeNull();
  });

  it('cannot break out of the inline script', () => {
    const [inline] = umamiScripts({ ...base, ignore: ['</script><script>alert(1)'] });
    expect(inline.innerHTML).not.toContain('</script>');
  });
});
