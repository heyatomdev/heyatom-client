import { HeyAtomHttp, seg, toFormData, type FileInput, type HeyAtomClientOptions, type RequestOptions } from '../core/http.js';
import type { BodyOf, FormFieldsOf, QueryOf, ResponseOf } from '../core/openapi.js';
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

  /** `GET /images/:imageId?info=true` — the image's metadata (tags, owner, URLs), not the file. */
  getImageInfo(imageId: string, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'ImageController_getImage'>>>('GET', `/images/${seg(imageId)}`, { query: { info: true } }, opts);
  }

  /** `PATCH /images/:imageId` — tags, description, isPrivate, blurPublic; only the owner (`opts.userId`). */
  updateImage(imageId: string, body: BodyOf<Op<'ImageController_updateImage'>>, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'ImageController_updateImage'>>>('PATCH', `/images/${seg(imageId)}`, { body }, opts);
  }

  /** `DELETE /images/:imageId`. */
  deleteImage(imageId: string, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'ImageController_deleteImage'>>>('DELETE', `/images/${seg(imageId)}`, {}, opts);
  }

  /** `POST /files` — multipart `file` (.zip or .pdf) plus `isPrivate`; the creator is `opts.userId`. */
  uploadFile(file: FileInput, fields: FormFieldsOf<Op<'FileController_uploadFile'>> = {}, opts?: RequestOptions) {
    return this.http.upload<ResponseOf<Op<'FileController_uploadFile'>>>('POST', '/files', toFormData('file', [file], fields), opts);
  }

  /** `GET /files` — paginated; `creatorId` is the creator's external id. */
  listFiles(query?: QueryOf<Op<'FileController_listFiles'>>, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'FileController_listFiles'>>>('GET', '/files', { query: query as never }, opts);
  }

  /** `DELETE /files/:fileId`. */
  deleteFile(fileId: string, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'FileController_deleteFile'>>>('DELETE', `/files/${seg(fileId)}`, {}, opts);
  }

  /**
   * `POST /files/:fileId/link` — a signed download URL valid 10 minutes, for a private file.
   * No download method: hand the URL (or a public file's `downloadUrl`) to the browser.
   */
  createFileLink(fileId: string, opts?: RequestOptions) {
    return this.http.json<ResponseOf<Op<'FileController_createLink'>>>('POST', `/files/${seg(fileId)}/link`, {}, opts);
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
