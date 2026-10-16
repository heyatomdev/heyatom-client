import { BadGatewayException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { HeyAtomHttpError } from '../core/http.js';

/**
 * Maps a client error to the `HttpException` your service answers with (api standard §14):
 * upstream down or timed out → 503 `UNAVAILABLE`, 404 → 404 `NOT_FOUND`, anything else → 502 `UPSTREAM`.
 * The upstream body never reaches your caller. Anything that is not a `HeyAtomHttpError` comes back unchanged.
 * ```ts
 * catch (err) { throw toHttpException(err); }
 * ```
 * Handle the statuses that mean something in your domain (409, 400, …) before calling it.
 */
export function toHttpException(err: unknown): unknown {
  if (!(err instanceof HeyAtomHttpError)) return err;
  if (err.status === 404) return new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
  if (err.status === 503 || err.status === 504) {
    return new ServiceUnavailableException({ code: 'UNAVAILABLE', message: 'Upstream service unavailable' });
  }
  return new BadGatewayException({ code: 'UPSTREAM', message: 'Upstream service error' });
}
