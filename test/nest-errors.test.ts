import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { HeyAtomHttpError, toHttpException } from '../src/fileharbor/nest/index.js';

const mapped = (status: number) => toHttpException(new HeyAtomHttpError('FileHarbor', status, { message: 'secret upstream detail' }, 'x')) as HttpException;

describe('toHttpException', () => {
  it('maps per api standard §14 without leaking the upstream body', () => {
    expect([404, 503, 504, 401, 400, 500].map((s) => mapped(s).getStatus())).toEqual([404, 503, 503, 502, 502, 502]);
    expect(mapped(503).getResponse()).toEqual({ code: 'UNAVAILABLE', message: 'Upstream service unavailable' });
    expect(JSON.stringify(mapped(500).getResponse())).not.toContain('secret');
  });

  it('returns anything else unchanged', () => {
    const e = new Error('boom');
    expect(toHttpException(e)).toBe(e);
  });
});
