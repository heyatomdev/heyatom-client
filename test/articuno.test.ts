import { describe, expect, it } from 'vitest';
import { BastionHttp, ServiceTokenProvider } from '@heyatom/bastion-client';
import { apiKeyAuth, ArticunoAdminClient, ArticunoClient, bearerAuth, serviceTokenAuth } from '../src/articuno/index.js';
import { fakeFetch, json } from './helpers.js';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = `${b64({ alg: 'RS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, tenantId: 't-1' })}.sig`;

describe('ArticunoClient', () => {
  it('scopes every call with the tenant key and sends X-User-Id where Articuno needs it', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { liked: true }));
    const articuno = new ArticunoClient({ baseUrl: 'http://articuno', auth: apiKeyAuth('tenant-key'), fetch: fetchImpl });

    await articuno.toggleLike('art-1', 'user-1');
    await articuno.listMyBookmarks('user-1', { page: 1, limit: 10 });
    await articuno.getArticle('hello-world', { languageCode: 'it' });

    expect(calls.map((c) => c.url)).toEqual([
      'http://articuno/interactions/articles/art-1/like',
      'http://articuno/bookmarks/me?page=1&limit=10',
      'http://articuno/articles/hello-world?languageCode=it',
    ]);
    for (const c of calls) expect(c.headers['X-API-Key']).toBe('tenant-key');
    expect(calls[0].headers['X-User-Id']).toBe('user-1');
    expect(calls[1].headers['X-User-Id']).toBe('user-1');
  });

  it('authenticates with a service-client token minted by bastion-client for articuno', async () => {
    const minted: unknown[] = [];
    const bastionFetch = (async (_url: string, init: RequestInit) => {
      minted.push(JSON.parse(init.body as string));
      return json(200, { accessToken: fakeJwt, tokenType: 'Bearer', expiresIn: 3600 });
    }) as unknown as typeof fetch;
    const tokens = new ServiceTokenProvider(new BastionHttp({ baseUrl: 'http://bastion', fetch: bastionFetch }), {
      apiKey: 'client-key',
      serviceSlug: 'articuno',
    });
    const { fetchImpl, calls } = fakeFetch(() => json(200, { data: [], meta: {} }));
    const articuno = new ArticunoClient({ baseUrl: 'http://articuno', auth: serviceTokenAuth(tokens, 'articuno'), fetch: fetchImpl });

    await articuno.listTags();
    await articuno.syncUser({ externalId: 'u-1', username: 'a' });

    expect(minted).toEqual([{ apiKey: 'client-key', serviceSlug: 'articuno' }]); // cached across calls
    expect(calls[1].headers).toEqual({ 'Content-Type': 'application/json', Authorization: `Bearer ${fakeJwt}` });
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ externalId: 'u-1', username: 'a' });
  });

  it('refuses an unscoped call: no tenant credential, no request', async () => {
    const { fetchImpl, calls } = fakeFetch();
    const articuno = new ArticunoClient({ baseUrl: 'http://articuno', auth: () => ({ Authorization: 'Bearer ' }), fetch: fetchImpl });
    await expect(articuno.listArticles()).rejects.toThrow(/Articuno: auth returned no X-API-Key or Bearer/);
    expect(calls).toHaveLength(0);
  });
});

describe('ArticunoAdminClient', () => {
  it('creates an article as JSON, or as multipart data + coverImage when a cover is attached', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(201, { id: 'a1' }));
    const admin = new ArticunoAdminClient({ baseUrl: 'http://articuno', auth: bearerAuth('user-jwt'), fetch: fetchImpl });
    const data = { categoryId: 'c1', translations: [{ languageCode: 'en', title: 'Hi', content: '...' }] } as never;

    await admin.createArticle(data);
    await admin.updateArticle('a1', { status: 'PUBLISHED' } as never, { data: new Uint8Array([1]), filename: 'c.png', contentType: 'image/png' });

    expect([calls[0].url, calls[0].headers['Content-Type'], JSON.parse(calls[0].init.body as string)]).toEqual([
      'http://articuno/admin/articles',
      'application/json',
      data,
    ]);
    const form = calls[1].init.body as FormData;
    expect([calls[1].init.method, calls[1].url]).toEqual(['PATCH', 'http://articuno/admin/articles/a1']);
    expect(JSON.parse(form.get('data') as string)).toEqual({ status: 'PUBLISHED' });
    expect((form.get('coverImage') as File).name).toBe('c.png');
    expect(calls[1].headers).toEqual({ Authorization: 'Bearer user-jwt' });
  });
});
