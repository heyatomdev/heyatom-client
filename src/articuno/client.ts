import { HeyAtomHttp, seg, type HeyAtomClientOptions, type RequestOptions } from '../core/http.js';
import type { BodyOf, QueryOf, ResponseOf } from '../core/openapi.js';
import type { operations } from './types.gen.js';

type Res<K extends keyof operations> = ResponseOf<operations[K]>;
type Q<K extends keyof operations> = QueryOf<operations[K]>;
type B<K extends keyof operations> = BodyOf<operations[K]>;

/**
 * Articuno's public (machine-to-machine) surface. The credential **is** the tenant
 * scope: a tenant `X-API-Key` (`apiKeyAuth`) or a Bastion service-client Bearer
 * minted for `articuno` (`serviceTokenAuth(provider, 'articuno')`), whose
 * `tenantId` Articuno maps onto its tenant. Every call carries one; the client
 * throws before sending when `auth` yields neither, so no request can reach
 * Articuno unscoped. A user JWT is refused here — that is `ArticunoAdminClient`.
 *
 * Lists are `{ data, meta: { total, page, limit, totalPages } }`, paged with
 * `page` (1-based) and `limit` (max 100).
 */
export class ArticunoClient {
  protected readonly http: HeyAtomHttp;

  constructor(options: HeyAtomClientOptions) {
    this.http = new HeyAtomHttp('Articuno', options);
  }

  private get<K extends keyof operations>(path: string, query?: object, opts?: RequestOptions) {
    return this.http.json<Res<K>>('GET', path, { query: query as never }, opts);
  }

  // Articles (read-only)
  listArticles(query?: Q<'ArticlesController_findAll'>, opts?: RequestOptions) {
    return this.get<'ArticlesController_findAll'>('/articles', query, opts);
  }
  /** By slug, not by id. */
  getArticle(slug: string, query?: Q<'ArticlesController_findOne'>, opts?: RequestOptions) {
    return this.get<'ArticlesController_findOne'>(`/articles/${seg(slug)}`, query, opts);
  }
  listTranslations(articleId: string, opts?: RequestOptions) {
    return this.get<'ArticleTranslationsController_findAll'>(`/articles/${seg(articleId)}/translations`, undefined, opts);
  }
  getTranslation(articleId: string, languageCode: string, opts?: RequestOptions) {
    return this.get<'ArticleTranslationsController_findOne'>(`/articles/${seg(articleId)}/translations/${seg(languageCode)}`, undefined, opts);
  }

  // Categories, tags (read-only)
  listCategories(query?: Q<'CategoriesController_findAll'>, opts?: RequestOptions) {
    return this.get<'CategoriesController_findAll'>('/categories', query, opts);
  }
  getCategory(slug: string, opts?: RequestOptions) {
    return this.get<'CategoriesController_findOne'>(`/categories/${seg(slug)}`, undefined, opts);
  }
  listTags(query?: Q<'TagsController_findAll'>, opts?: RequestOptions) {
    return this.get<'TagsController_findAll'>('/tags', query, opts);
  }
  getTag(slug: string, opts?: RequestOptions) {
    return this.get<'TagsController_findOne'>(`/tags/${seg(slug)}`, undefined, opts);
  }

  // Comments
  createComment(body: B<'CommentsController_create'>, opts?: RequestOptions) {
    return this.http.json<Res<'CommentsController_create'>>('POST', '/comments', { body }, opts);
  }
  listComments(query?: Q<'CommentsController_findAll'>, opts?: RequestOptions) {
    return this.get<'CommentsController_findAll'>('/comments', query, opts);
  }
  getComment(id: string, opts?: RequestOptions) {
    return this.get<'CommentsController_findOne'>(`/comments/${seg(id)}`, undefined, opts);
  }
  updateComment(id: string, body: B<'CommentsController_update'>, opts?: RequestOptions) {
    return this.http.json<Res<'CommentsController_update'>>('PATCH', `/comments/${seg(id)}`, { body }, opts);
  }
  deleteComment(id: string, opts?: RequestOptions) {
    return this.http.json<Res<'CommentsController_remove'>>('DELETE', `/comments/${seg(id)}`, {}, opts);
  }

  // Interactions, bookmarks: `userId` (X-User-Id) is required, Articuno answers 400 without it
  toggleLike(articleId: string, userId: string, opts?: RequestOptions) {
    return this.http.json<Res<'InteractionsController_toggleLikeArticle'>>('POST', `/interactions/articles/${seg(articleId)}/like`, {}, { ...opts, userId });
  }
  getInteractionStatus(articleId: string, userId: string, opts?: RequestOptions) {
    return this.get<'InteractionsController_getArticleStatus'>(`/interactions/articles/${seg(articleId)}/status`, undefined, { ...opts, userId });
  }
  toggleBookmark(articleId: string, userId: string, opts?: RequestOptions) {
    return this.http.json<Res<'BookmarksController_toggle'>>('POST', `/bookmarks/${seg(articleId)}`, {}, { ...opts, userId });
  }
  listMyBookmarks(userId: string, query?: Q<'BookmarksController_findAll'>, opts?: RequestOptions) {
    return this.get<'BookmarksController_findAll'>('/bookmarks/me', query, { ...opts, userId });
  }

  // Reports
  createReport(body: B<'ReportsController_create'>, opts?: RequestOptions) {
    return this.http.json<Res<'ReportsController_create'>>('POST', '/reports', { body }, opts);
  }
  listReports(query?: Q<'ReportsController_findAll'>, opts?: RequestOptions) {
    return this.get<'ReportsController_findAll'>('/reports', query, opts);
  }
  updateReportStatus(id: string, body: B<'ReportsController_updateStatus'>, opts?: RequestOptions) {
    return this.http.json<Res<'ReportsController_updateStatus'>>('PATCH', `/reports/${seg(id)}/status`, { body }, opts);
  }

  // Users
  /** Upsert by `externalId` (the caller's user id). */
  syncUser(body: B<'UsersController_upsert'>, opts?: RequestOptions) {
    return this.http.json<Res<'UsersController_upsert'>>('POST', '/users/sync', { body }, opts);
  }
  deleteUser(externalId: string, opts?: RequestOptions) {
    return this.http.json<Res<'UsersController_remove'>>('DELETE', `/users/${seg(externalId)}`, {}, opts);
  }
}
