import { HeyAtomHttp, seg, toFormData, type FileInput, type HeyAtomClientOptions, type RequestOptions } from '../core/http.js';
import type { BodyOf, QueryOf, ResponseOf } from '../core/openapi.js';
import type { components, operations } from './types.gen.js';

type Res<K extends keyof operations> = ResponseOf<operations[K]>;
type Q<K extends keyof operations> = QueryOf<operations[K]>;
type B<K extends keyof operations> = BodyOf<operations[K]>;
type Schemas = components['schemas'];

/**
 * Articuno's console surface (`/admin/*`), authenticated by a Bastion **user**
 * JWT (`bearerAuth(token)`), as Meridian forwards it. The tenant scope is the
 * token's `tenantId`, which Articuno maps via `Tenant.bastionTenantId`; a
 * tenant without that mapping answers 403. `reporterId`/`moderatorId` are
 * stamped from the token, never sent.
 */
export class ArticunoAdminClient {
  protected readonly http: HeyAtomHttp;

  constructor(options: HeyAtomClientOptions) {
    this.http = new HeyAtomHttp('Articuno', options);
  }

  private get<K extends keyof operations>(path: string, query?: object, opts?: RequestOptions) {
    return this.http.json<Res<K>>('GET', path, { query: query as never }, opts);
  }

  private del<K extends keyof operations>(path: string, opts?: RequestOptions) {
    return this.http.json<Res<K>>('DELETE', path, {}, opts);
  }

  // Articles. `status` in the body is how an article is published, hidden or banned.
  listArticles(query?: Q<'AdminArticlesController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminArticlesController_findAll'>('/admin/articles', query, opts);
  }
  /** By id or slug. */
  getArticle(key: string, opts?: RequestOptions) {
    return this.get<'AdminArticlesController_findOne'>(`/admin/articles/${seg(key)}`, undefined, opts);
  }
  /** JSON, or multipart (`data` + `coverImage`) when a cover is attached. */
  createArticle(data: Schemas['CreateArticleDto'], coverImage?: FileInput, opts?: RequestOptions) {
    return coverImage
      ? this.http.upload<Res<'AdminArticlesController_create'>>('POST', '/admin/articles', this.articleForm(data, coverImage), opts)
      : this.http.json<Res<'AdminArticlesController_create'>>('POST', '/admin/articles', { body: data }, opts);
  }
  updateArticle(id: string, data: Schemas['UpdateArticleDto'], coverImage?: FileInput, opts?: RequestOptions) {
    const path = `/admin/articles/${seg(id)}`;
    return coverImage
      ? this.http.upload<Res<'AdminArticlesController_update'>>('PATCH', path, this.articleForm(data, coverImage), opts)
      : this.http.json<Res<'AdminArticlesController_update'>>('PATCH', path, { body: data }, opts);
  }
  deleteArticle(id: string, opts?: RequestOptions) {
    return this.del<'AdminArticlesController_remove'>(`/admin/articles/${seg(id)}`, opts);
  }
  private articleForm(data: object, coverImage: FileInput): FormData {
    return toFormData('coverImage', [coverImage], { data: JSON.stringify(data) });
  }

  // Translations
  /** Plain array without `content`, not a page envelope. */
  listTranslations(articleId: string, opts?: RequestOptions) {
    return this.get<'AdminArticlesController_findTranslations'>(`/admin/articles/${seg(articleId)}/translations`, undefined, opts);
  }
  getTranslation(articleId: string, languageCode: string, opts?: RequestOptions) {
    return this.get<'AdminArticlesController_findTranslation'>(`/admin/articles/${seg(articleId)}/translations/${seg(languageCode)}`, undefined, opts);
  }
  createTranslation(articleId: string, body: B<'AdminArticlesController_createTranslation'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminArticlesController_createTranslation'>>('POST', `/admin/articles/${seg(articleId)}/translations`, { body }, opts);
  }
  updateTranslation(articleId: string, languageCode: string, body: B<'AdminArticlesController_updateTranslation'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminArticlesController_updateTranslation'>>('PATCH', `/admin/articles/${seg(articleId)}/translations/${seg(languageCode)}`, { body }, opts);
  }
  deleteTranslation(articleId: string, languageCode: string, opts?: RequestOptions) {
    return this.del<'AdminArticlesController_removeTranslation'>(`/admin/articles/${seg(articleId)}/translations/${seg(languageCode)}`, opts);
  }

  // Categories
  listCategories(query?: Q<'AdminCategoriesController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminCategoriesController_findAll'>('/admin/categories', query, opts);
  }
  getCategory(id: string, opts?: RequestOptions) {
    return this.get<'AdminCategoriesController_findOne'>(`/admin/categories/${seg(id)}`, undefined, opts);
  }
  createCategory(body: B<'AdminCategoriesController_create'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminCategoriesController_create'>>('POST', '/admin/categories', { body }, opts);
  }
  updateCategory(id: string, body: B<'AdminCategoriesController_update'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminCategoriesController_update'>>('PATCH', `/admin/categories/${seg(id)}`, { body }, opts);
  }
  deleteCategory(id: string, opts?: RequestOptions) {
    return this.del<'AdminCategoriesController_remove'>(`/admin/categories/${seg(id)}`, opts);
  }

  // Tags
  listTags(query?: Q<'AdminTagsController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminTagsController_findAll'>('/admin/tags', query, opts);
  }
  getTag(id: string, opts?: RequestOptions) {
    return this.get<'AdminTagsController_findOne'>(`/admin/tags/${seg(id)}`, undefined, opts);
  }
  createTag(body: B<'AdminTagsController_create'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminTagsController_create'>>('POST', '/admin/tags', { body }, opts);
  }
  updateTag(id: string, body: B<'AdminTagsController_update'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminTagsController_update'>>('PATCH', `/admin/tags/${seg(id)}`, { body }, opts);
  }
  deleteTag(id: string, opts?: RequestOptions) {
    return this.del<'AdminTagsController_remove'>(`/admin/tags/${seg(id)}`, opts);
  }

  // Banned words
  listBannedWords(query?: Q<'AdminBannedWordsController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminBannedWordsController_findAll'>('/admin/banned-words', query, opts);
  }
  /** Lowercased upstream; 409 on a duplicate. */
  createBannedWord(body: B<'AdminBannedWordsController_create'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminBannedWordsController_create'>>('POST', '/admin/banned-words', { body }, opts);
  }
  deleteBannedWord(id: string, opts?: RequestOptions) {
    return this.del<'AdminBannedWordsController_remove'>(`/admin/banned-words/${seg(id)}`, opts);
  }

  // Comments
  listComments(query?: Q<'AdminCommentsController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminCommentsController_findAll'>('/admin/comments', query, opts);
  }
  getComment(id: string, opts?: RequestOptions) {
    return this.get<'AdminCommentsController_findOne'>(`/admin/comments/${seg(id)}`, undefined, opts);
  }
  updateComment(id: string, body: B<'AdminCommentsController_update'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminCommentsController_update'>>('PATCH', `/admin/comments/${seg(id)}`, { body }, opts);
  }
  deleteComment(id: string, opts?: RequestOptions) {
    return this.del<'AdminCommentsController_remove'>(`/admin/comments/${seg(id)}`, opts);
  }

  // Reports
  listReports(query?: Q<'AdminReportsController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminReportsController_findAll'>('/admin/reports', query, opts);
  }
  getReport(id: string, opts?: RequestOptions) {
    return this.get<'AdminReportsController_findOne'>(`/admin/reports/${seg(id)}`, undefined, opts);
  }
  createReport(body: B<'AdminReportsController_create'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminReportsController_create'>>('POST', '/admin/reports', { body }, opts);
  }
  updateReportStatus(id: string, body: B<'AdminReportsController_updateStatus'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminReportsController_updateStatus'>>('PATCH', `/admin/reports/${seg(id)}/status`, { body }, opts);
  }

  // Users
  listUsers(query?: Q<'AdminUsersController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminUsersController_findAll'>('/admin/users', query, opts);
  }
  getUser(id: string, opts?: RequestOptions) {
    return this.get<'AdminUsersController_findOne'>(`/admin/users/${seg(id)}`, undefined, opts);
  }
  updateUserStatus(id: string, body: B<'AdminUsersController_updateStatus'>, opts?: RequestOptions) {
    return this.http.json<Res<'AdminUsersController_updateStatus'>>('PATCH', `/admin/users/${seg(id)}/status`, { body }, opts);
  }
  /** Deletes the user and everything they wrote. */
  deleteUser(id: string, opts?: RequestOptions) {
    return this.del<'AdminUsersController_remove'>(`/admin/users/${seg(id)}`, opts);
  }

  // Audits, notifications, webhooks, stats
  listAudits(query?: Q<'AdminAuditsController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminAuditsController_findAll'>('/admin/audits', query, opts);
  }
  getAudit(id: string, opts?: RequestOptions) {
    return this.get<'AdminAuditsController_findOne'>(`/admin/audits/${seg(id)}`, undefined, opts);
  }
  listNotifications(query?: Q<'AdminNotificationsController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminNotificationsController_findAll'>('/admin/notifications', query, opts);
  }
  getNotification(id: string, opts?: RequestOptions) {
    return this.get<'AdminNotificationsController_findOne'>(`/admin/notifications/${seg(id)}`, undefined, opts);
  }
  /** `sent`: `true` delivered, `false` still in the outbox, absent for all. */
  listWebhooks(query?: Q<'AdminWebhooksController_findAll'>, opts?: RequestOptions) {
    return this.get<'AdminWebhooksController_findAll'>('/admin/webhooks', query, opts);
  }
  getWebhook(id: string, opts?: RequestOptions) {
    return this.get<'AdminWebhooksController_findOne'>(`/admin/webhooks/${seg(id)}`, undefined, opts);
  }
  /** 400 when the event was already delivered. */
  resendWebhook(id: string, opts?: RequestOptions) {
    return this.http.json<Res<'AdminWebhooksController_resendOne'>>('POST', `/admin/webhooks/${seg(id)}/resend`, {}, opts);
  }
  /** Resets attempts on every undelivered event of the tenant → `{ reset: n }`. */
  resendAllFailedWebhooks(opts?: RequestOptions) {
    return this.http.json<Res<'AdminWebhooksController_resendAllFailed'>>('POST', '/admin/webhooks/resend-all-failed', {}, opts);
  }
  /** `totals` are all-time, only `history` is scoped to `days`. */
  getDashboardStats(query: Q<'AdminStatsController_getDashboard'>, opts?: RequestOptions) {
    return this.get<'AdminStatsController_getDashboard'>('/admin/stats/dashboard', query, opts);
  }
}
