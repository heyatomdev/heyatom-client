import { HeyAtomHttp, seg, toFormData, type FileInput, type HeyAtomClientOptions, type RequestOptions } from '../core/http.js';
import type { BodyOf, FormFieldsOf, ResponseOf } from '../core/openapi.js';
import type { operations } from './types.gen.js';

type Op<K extends keyof operations> = operations[K];

/**
 * FileHarbor's client surface, authenticated by a client API key (`apiKeyAuth`).
 * Pass `{ userId }` per call to send `X-User-Id`: the creator the content is
 * attributed to, as the caller's own user id; omit it for system-level uploads.
 *
 * Transport only: MIME allowlists, size limits, replace-and-cleanup and
 * "404 on delete means already gone" stay in the consuming app.
 */
export class FileHarborClient {
  protected readonly http: HeyAtomHttp;

  constructor(options: HeyAtomClientOptions) {
    this.http = new HeyAtomHttp('FileHarbor', options);
  }

  /** `POST /images` — multipart `file` plus metadata. */
  uploadImage(file: FileInput, fields: FormFieldsOf<Op<'ImageController_uploadImage'>> = {}, opts?: RequestOptions) {
    return this.http.upload<ResponseOf<Op<'ImageController_uploadImage'>>>('POST', '/images', toFormData('file', [file], fields), opts);
  }

  /** `PATCH /images/:imageId` — tags, description, isPrivate; only the owner (`opts.userId`). */
  updateImage(imageId: string, body: BodyOf<Op<'ImageController_updateImage'>>, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'ImageController_updateImage'>>>('PATCH', `/images/${seg(imageId)}`, { body }, opts);
  }

  /** `DELETE /images/:imageId`. */
  deleteImage(imageId: string, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'ImageController_deleteImage'>>>('DELETE', `/images/${seg(imageId)}`, {}, opts);
  }

  /** `POST /avatars` — one avatar per `externalUserId`, an upload replaces the previous one. */
  uploadAvatar(externalUserId: string, file: FileInput, opts?: RequestOptions) {
    return this.http.upload<ResponseOf<Op<'AvatarController_uploadAvatar'>>>('POST', '/avatars', toFormData('file', [file], { externalUserId }), opts);
  }

  /** `DELETE /avatars/:externalUserId` — only that user's avatar folder, never a shared pool image. */
  deleteAvatar(externalUserId: string, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'AvatarController_deleteAvatar'>>>('DELETE', `/avatars/${seg(externalUserId)}`, {}, opts);
  }

  /** `GET /client/stats` — usage of the client the API key belongs to. */
  getClientStats(opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'ClientController_getStats'>>>('GET', '/client/stats', {}, opts);
  }
}
