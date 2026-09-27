import { describe, expect, it } from 'vitest';
import { apiKeyAuth, FileHarborClient } from '../src/fileharbor/index.js';
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
