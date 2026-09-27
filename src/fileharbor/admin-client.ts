import { HeyAtomHttp, seg, toFormData, type FileInput, type HeyAtomClientOptions, type RequestOptions } from '../core/http.js';
import type { BodyOf, FormFieldsOf, QueryOf, ResponseOf } from '../core/openapi.js';
import type { operations } from './types.gen.js';

type Op<K extends keyof operations> = operations[K];
type Res<K extends keyof operations> = ResponseOf<operations[K]>;
type Q<K extends keyof operations> = QueryOf<operations[K]>;
type B<K extends keyof operations> = BodyOf<operations[K]>;

/**
 * FileHarbor's console surface, authenticated by a Bastion **user** JWT
 * (`bearerAuth(token)`), as Meridian forwards it. `/admin/*` is scoped to the
 * token's tenant and checks the `fileharbor-*` permission itself; the `me*`
 * methods hit the self-service `/me/*` surface with the same token, where an
 * unmapped tenant answers 422.
 *
 * `baseUrl` is the service root: FileHarbor serves `/admin` and `/me` unprefixed
 * (any proxy prefix belongs in `baseUrl`).
 */
export class FileHarborAdminClient {
  protected readonly http: HeyAtomHttp;

  constructor(options: HeyAtomClientOptions) {
    this.http = new HeyAtomHttp('FileHarbor', options);
  }

  private get<K extends keyof operations>(path: string, query?: object, opts?: RequestOptions) {
    return this.http.json<Res<K>>('GET', path, { query: query as never }, opts);
  }

  // Clients
  listClients(opts?: RequestOptions) {
    return this.get<'ClientsAdminController_listClients'>('/admin/clients', undefined, opts);
  }
  getClient(id: string, opts?: RequestOptions) {
    return this.get<'ClientsAdminController_getClient'>(`/admin/clients/${seg(id)}`, undefined, opts);
  }
  /** The answer carries the plaintext `apiKey`, returned only here. */
  createClient(body: B<'ClientsAdminController_createClient'>, opts?: RequestOptions) {
    return this.http.json<Res<'ClientsAdminController_createClient'>>('POST', '/admin/clients', { body }, opts);
  }
  updateClient(id: string, body: B<'ClientsAdminController_updateClient'>, opts?: RequestOptions) {
    return this.http.json<Res<'ClientsAdminController_updateClient'>>('PATCH', `/admin/clients/${seg(id)}`, { body }, opts);
  }

  getStats(opts?: RequestOptions) {
    return this.get<'StatisticsController_getGlobalStats'>('/admin/stats', undefined, opts);
  }
  listTags(query?: Q<'TagController_listTags'>, opts?: RequestOptions) {
    return this.get<'TagController_listTags'>('/admin/tags', query, opts);
  }

  // Images
  listImages(query?: Q<'ImagesAdminController_listImages'>, opts?: RequestOptions) {
    return this.get<'ImagesAdminController_listImages'>('/admin/images', query, opts);
  }
  getImage(id: string, opts?: RequestOptions) {
    return this.get<'ImagesAdminController_getImage'>(`/admin/images/${seg(id)}`, undefined, opts);
  }
  /** `POST /admin/images` — one or more files under `files`, all sharing `fields`; `clientId` is required. */
  uploadImages(files: FileInput[], fields: FormFieldsOf<Op<'ImagesAdminController_uploadImage'>>, opts?: RequestOptions) {
    return this.http.upload<Res<'ImagesAdminController_uploadImage'>>('POST', '/admin/images', toFormData('files', files, fields), opts);
  }
  updateImage(id: string, body: B<'ImagesAdminController_updateImage'>, opts?: RequestOptions) {
    return this.http.json<Res<'ImagesAdminController_updateImage'>>('PATCH', `/admin/images/${seg(id)}`, { body }, opts);
  }
  deleteImage(id: string, opts?: RequestOptions) {
    return this.http.json<Res<'ImagesAdminController_deleteImage'>>('DELETE', `/admin/images/${seg(id)}`, {}, opts);
  }
  /** Raw `Response` (attachment). `thumb: true` for the webp thumbnail. Increments the download counter. */
  downloadImage(id: string, query?: Q<'ImagesAdminController_downloadImage'>, opts?: RequestOptions) {
    return this.http.raw(`/admin/images/${seg(id)}/download`, query as never, opts);
  }
  /** 400 when Tinify is disabled, keyless, over quota, or the image was already compressed. */
  tinifyCompressImage(id: string, opts?: RequestOptions) {
    return this.http.json<Res<'ImagesAdminController_compressImageWithTinify'>>('POST', `/admin/images/${seg(id)}/tinify-compress`, {}, opts);
  }

  // Videos
  listVideos(query?: Q<'VideosAdminController_listVideos'>, opts?: RequestOptions) {
    return this.get<'VideosAdminController_listVideos'>('/admin/videos', query, opts);
  }
  getVideo(id: string, opts?: RequestOptions) {
    return this.get<'VideosAdminController_getVideo'>(`/admin/videos/${seg(id)}`, undefined, opts);
  }
  updateVideo(id: string, body: B<'VideosAdminController_updateVideo'>, opts?: RequestOptions) {
    return this.http.json<Res<'VideosAdminController_updateVideo'>>('PATCH', `/admin/videos/${seg(id)}`, { body }, opts);
  }
  deleteVideo(id: string, opts?: RequestOptions) {
    return this.http.json<Res<'VideosAdminController_deleteVideo'>>('DELETE', `/admin/videos/${seg(id)}`, {}, opts);
  }
  /** Raw `Response`. Forward the browser's `Range` in `opts.headers` and pass `Content-Range`/`Accept-Ranges` back so `<video>` can seek. */
  streamVideo(id: string, opts?: RequestOptions) {
    return this.http.raw(`/admin/videos/${seg(id)}/stream`, undefined, opts);
  }
  /** Raw `Response`: the poster frame. */
  videoThumb(id: string, opts?: RequestOptions) {
    return this.http.raw(`/admin/videos/${seg(id)}/thumb`, undefined, opts);
  }

  // Avatars
  listAvatars(query?: Q<'AvatarsAdminController_listAvatars'>, opts?: RequestOptions) {
    return this.get<'AvatarsAdminController_listAvatars'>('/admin/avatars', query, opts);
  }
  getAvatar(id: string, opts?: RequestOptions) {
    return this.get<'AvatarsAdminController_getAvatar'>(`/admin/avatars/${seg(id)}`, undefined, opts);
  }
  deleteAvatar(id: string, opts?: RequestOptions) {
    return this.http.json<Res<'AvatarsAdminController_deleteAvatar'>>('DELETE', `/admin/avatars/${seg(id)}`, {}, opts);
  }

  // Albums
  listAlbums(query?: Q<'AlbumsAdminController_listAlbums'>, opts?: RequestOptions) {
    return this.get<'AlbumsAdminController_listAlbums'>('/admin/albums', query, opts);
  }
  getAlbum(id: string, opts?: RequestOptions) {
    return this.get<'AlbumsAdminController_getAlbum'>(`/admin/albums/${seg(id)}`, undefined, opts);
  }
  createAlbum(body: B<'AlbumsAdminController_createAlbum'>, opts?: RequestOptions) {
    return this.http.json<Res<'AlbumsAdminController_createAlbum'>>('POST', '/admin/albums', { body }, opts);
  }
  updateAlbum(id: string, body: B<'AlbumsAdminController_updateAlbum'>, opts?: RequestOptions) {
    return this.http.json<Res<'AlbumsAdminController_updateAlbum'>>('PATCH', `/admin/albums/${seg(id)}`, { body }, opts);
  }
  deleteAlbum(id: string, opts?: RequestOptions) {
    return this.http.json<Res<'AlbumsAdminController_deleteAlbum'>>('DELETE', `/admin/albums/${seg(id)}`, {}, opts);
  }
  listAlbumItems(id: string, query?: Q<'AlbumsAdminController_listItems'>, opts?: RequestOptions) {
    return this.get<'AlbumsAdminController_listItems'>(`/admin/albums/${seg(id)}/items`, query, opts);
  }
  /** Body `{ items: [{ id, resourceType }] }`, bypassing ownership checks. */
  addAlbumItems(id: string, body: B<'AlbumsAdminController_addItems'>, opts?: RequestOptions) {
    return this.http.json<Res<'AlbumsAdminController_addItems'>>('POST', `/admin/albums/${seg(id)}/items`, { body }, opts);
  }
  removeAlbumItems(id: string, body: B<'AlbumsAdminController_removeItems'>, opts?: RequestOptions) {
    return this.http.json<Res<'AlbumsAdminController_removeItems'>>('DELETE', `/admin/albums/${seg(id)}/items`, { body }, opts);
  }

  // Creators
  listCreators(query?: Q<'CreatorsAdminController_listCreators'>, opts?: RequestOptions) {
    return this.get<'CreatorsAdminController_listCreators'>('/admin/creators', query, opts);
  }
  getCreator(id: string, opts?: RequestOptions) {
    return this.get<'CreatorsAdminController_getCreator'>(`/admin/creators/${seg(id)}`, undefined, opts);
  }
  createCreator(body: B<'CreatorsAdminController_createCreator'>, opts?: RequestOptions) {
    return this.http.json<Res<'CreatorsAdminController_createCreator'>>('POST', '/admin/creators', { body }, opts);
  }
  updateCreator(id: string, body: B<'CreatorsAdminController_updateCreator'>, opts?: RequestOptions) {
    return this.http.json<Res<'CreatorsAdminController_updateCreator'>>('PATCH', `/admin/creators/${seg(id)}`, { body }, opts);
  }

  // Bookmarks (the current admin's)
  listImageBookmarks(query?: Q<'BookmarksAdminController_listBookmarks'>, opts?: RequestOptions) {
    return this.get<'BookmarksAdminController_listBookmarks'>('/admin/bookmarks', query, opts);
  }
  bookmarkImage(imageId: string, opts?: RequestOptions) {
    return this.http.json<Res<'BookmarksAdminController_bookmarkImage'>>('POST', `/admin/bookmarks/${seg(imageId)}`, {}, opts);
  }
  removeImageBookmark(imageId: string, opts?: RequestOptions) {
    return this.http.json<Res<'BookmarksAdminController_removeBookmark'>>('DELETE', `/admin/bookmarks/${seg(imageId)}`, {}, opts);
  }
  listVideoBookmarks(query?: Q<'BookmarksAdminController_listVideoBookmarks'>, opts?: RequestOptions) {
    return this.get<'BookmarksAdminController_listVideoBookmarks'>('/admin/bookmarks/videos', query, opts);
  }
  bookmarkVideo(videoId: string, opts?: RequestOptions) {
    return this.http.json<Res<'BookmarksAdminController_bookmarkVideo'>>('POST', `/admin/bookmarks/videos/${seg(videoId)}`, {}, opts);
  }
  removeVideoBookmark(videoId: string, opts?: RequestOptions) {
    return this.http.json<Res<'BookmarksAdminController_removeVideoBookmark'>>('DELETE', `/admin/bookmarks/videos/${seg(videoId)}`, {}, opts);
  }
  bookmarkCreator(creatorId: string, opts?: RequestOptions) {
    return this.http.json<Res<'BookmarksAdminController_bookmarkCreator'>>('POST', `/admin/bookmarks/creators/${seg(creatorId)}`, {}, opts);
  }
  removeCreatorBookmark(creatorId: string, opts?: RequestOptions) {
    return this.http.json<Res<'BookmarksAdminController_removeCreatorBookmark'>>('DELETE', `/admin/bookmarks/creators/${seg(creatorId)}`, {}, opts);
  }

  // Self-service (/me), same user token, no /admin prefix
  /** `{ enabled }`: whether the token's tenant has a FileHarbor client mapped. */
  getMyAvatar(opts?: RequestOptions) {
    return this.get<'MeController_getAvatar'>('/me/avatar', undefined, opts);
  }
  uploadMyAvatar(file: FileInput, opts?: RequestOptions) {
    return this.http.upload<Res<'MeController_uploadAvatar'>>('PUT', '/me/avatar', toFormData('file', [file]), opts);
  }
  deleteMyAvatar(opts?: RequestOptions) {
    return this.http.json<Res<'MeController_deleteAvatar'>>('DELETE', '/me/avatar', {}, opts);
  }
}
