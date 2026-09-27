import { describe, expect, it } from 'vitest';
import { apiKeyAuth, bearerAuth, FileHarborAdminClient, FileHarborClient } from '../src/fileharbor/index.js';
import { fakeFetch, json } from './helpers.js';

describe('FileHarborClient', () => {
  it('uploads an image as multipart: file with name and type, arrays as repeated fields', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(201, { id: 'img-1', fullPath: 'http://fh/v2/images/img-1' }));
    const fh = new FileHarborClient({ baseUrl: 'http://fh/v2', auth: apiKeyAuth('k'), fetch: fetchImpl });

    const res = await fh.uploadImage(
      { data: Buffer.from('png-bytes'), filename: 'a.png', contentType: 'image/png' },
      { description: 'Build image', tags: ['x', 'y'], isPrivate: true },
      { userId: 'user-9' },
    );

    expect(res.id).toBe('img-1');
    const { url, init, headers } = calls[0];
    expect(url).toBe('http://fh/v2/images');
    expect(headers).toEqual({ 'X-API-Key': 'k', 'X-User-Id': 'user-9' }); // no Content-Type: fetch sets the boundary
    const form = init.body as FormData;
    const file = form.get('file') as File;
    expect([file.name, file.type, await file.text()]).toEqual(['a.png', 'image/png', 'png-bytes']);
    expect(form.getAll('tags')).toEqual(['x', 'y']);
    expect(form.get('isPrivate')).toBe('true');
    expect(form.get('description')).toBe('Build image');
  });

  it('uploads an avatar with externalUserId in the form, not the header', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(201, { id: 'av' }));
    const fh = new FileHarborClient({ baseUrl: 'http://fh', auth: apiKeyAuth('k'), fetch: fetchImpl });
    await fh.uploadAvatar('user-1', { data: new Uint8Array([1, 2]), filename: 'avatar.webp' });
    const form = calls[0].init.body as FormData;
    expect(form.get('externalUserId')).toBe('user-1');
    expect(calls[0].headers['X-User-Id']).toBeUndefined();
  });
});

describe('FileHarborAdminClient', () => {
  it('forwards the user Bearer and serialises list filters', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { data: [] }));
    const admin = new FileHarborAdminClient({ baseUrl: 'http://fh', auth: bearerAuth('user-jwt'), fetch: fetchImpl });
    await admin.listImages({ page: 2, tags: ['a', 'b'], clientId: undefined, sortOrder: 'desc' });
    expect(calls[0].url).toBe('http://fh/admin/images?page=2&tags=a&tags=b&sortOrder=desc');
    expect(calls[0].headers).toEqual({ Authorization: 'Bearer user-jwt' });
  });

  it('returns the raw Response of a stream and passes Range through', async () => {
    const { fetchImpl, calls } = fakeFetch(() => new Response('bytes', { status: 206, headers: { 'content-range': 'bytes 0-4/10' } }));
    const admin = new FileHarborAdminClient({ baseUrl: 'http://fh', auth: bearerAuth('t'), fetch: fetchImpl });
    const res = await admin.streamVideo('v1', { headers: { Range: 'bytes=0-4' } });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-4/10');
    expect(await res.text()).toBe('bytes');
    expect(calls[0].headers.Range).toBe('bytes=0-4');
    expect(calls[0].init.signal).toBeUndefined(); // no timeout on a stream unless asked
  });

  it('uploads several files under `files` and the self-service avatar with PUT', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(201, []));
    const admin = new FileHarborAdminClient({ baseUrl: 'http://fh', auth: bearerAuth('t'), fetch: fetchImpl });
    const f = { data: new Uint8Array([1]), filename: 'a.jpg', contentType: 'image/jpeg' };
    await admin.uploadImages([f, { ...f, filename: 'b.jpg' }], { clientId: 'c-1' });
    expect((calls[0].init.body as FormData).getAll('files')).toHaveLength(2);
    await admin.uploadMyAvatar(f);
    expect([calls[1].init.method, calls[1].url]).toEqual(['PUT', 'http://fh/me/avatar']);
  });
});
