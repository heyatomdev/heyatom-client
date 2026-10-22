import { isAnonymousAuth, type AuthProvider } from './auth.js';

export interface HeyAtomLogger {
  warn(message: string): void;
  error(message: string): void;
  log(message: string): void;
}

export const silentLogger: HeyAtomLogger = {
  warn: () => undefined,
  error: () => undefined,
  log: () => undefined,
};

export interface HeyAtomClientOptions {
  /** Service base URL, including any prefix a reverse proxy adds (e.g. `http://fileharbor:3000/v2`). */
  baseUrl: string;
  /** Called before every request; returns the credential headers. See `apiKeyAuth`, `serviceTokenAuth`, `anonymousAuth`. */
  auth: AuthProvider;
  /** Per-request timeout, default 10 000 ms. Uploads default to 60 000 ms. */
  timeoutMs?: number;
  fetch?: typeof fetch;
  logger?: HeyAtomLogger;
}

export interface RequestOptions {
  /** Sent as `X-User-Id`: the caller's own user id, for routes that attribute or scope by user. */
  userId?: string;
  /** Extra headers. Credential headers from `auth` always win. */
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Sent as `X-Request-Id`: your own request id, so the service logs it as `clientRequestId`. */
  requestId?: string;
}

/** A file for a multipart upload. `data` takes a Node `Buffer` (multer's `file.buffer`) as-is. */
export interface FileInput {
  data: Blob | ArrayBuffer | Uint8Array;
  filename: string;
  contentType?: string;
}

export type Query = Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>;

/**
 * A non-2xx answer, or the service unreachable / timed out (`status` 503, `body` undefined).
 * `message` is the validation detail (`errors[]`) when present, else the service's own `message`.
 */
export class HeyAtomHttpError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'HeyAtomHttpError';
  }

  /** The service's stable error `code` (`NOT_FOUND`, `SLUG_TAKEN`, …), when it sent one. */
  get code(): string | undefined {
    const code = (this.body as { code?: unknown } | undefined)?.code;
    return typeof code === 'string' ? code : undefined;
  }

  /** The service's own request id, for correlating logs. */
  get requestId(): string | undefined {
    const id = (this.body as { requestId?: unknown } | undefined)?.requestId;
    return typeof id === 'string' ? id : undefined;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

/** Shared transport of every client. Not exported from the package: each client is the public face. */
export class HeyAtomHttp {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly auth: AuthProvider;
  private readonly anonymous: boolean;
  readonly logger: HeyAtomLogger;

  /** `allowAnonymous`: only for a client whose whole surface is anonymous (Beacon `/public`). */
  constructor(
    private readonly service: string,
    options: HeyAtomClientOptions,
    { allowAnonymous = false }: { allowAnonymous?: boolean } = {},
  ) {
    if (!options.baseUrl) throw new Error(`${service}: baseUrl is required`);
    if (typeof options.auth !== 'function') throw new Error(`${service}: auth is required`);
    this.anonymous = isAnonymousAuth(options.auth);
    if (this.anonymous && !allowAnonymous) throw new Error(`${service}: anonymousAuth is not accepted, this service requires a credential`);
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    // Late-bound on purpose: a consumer (or its tests) may replace global fetch after construction.
    this.fetchImpl = options.fetch ?? ((...args) => fetch(...args));
    this.auth = options.auth;
    this.logger = options.logger ?? silentLogger;
  }

  async json<T>(method: string, path: string, init: { query?: Query; body?: unknown } = {}, opts: RequestOptions = {}): Promise<T> {
    const res = await this.send(method, path, init.query, init.body, opts, opts.timeoutMs ?? this.timeoutMs);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  upload<T>(method: string, path: string, form: FormData, opts: RequestOptions = {}): Promise<T> {
    return this.json<T>(method, path, { body: form }, { ...opts, timeoutMs: opts.timeoutMs ?? Math.max(this.timeoutMs, UPLOAD_TIMEOUT_MS) });
  }

  private async send(
    method: string,
    path: string,
    query: Query | undefined,
    body: unknown,
    opts: RequestOptions,
    timeoutMs: number,
  ): Promise<Response> {
    const credentials = await this.auth();
    const lower = Object.fromEntries(Object.entries(credentials).map(([k, v]) => [k.toLowerCase(), v]));
    if (!this.anonymous && !lower['x-api-key'] && !/^Bearer \S/.test(lower['authorization'] ?? '')) {
      // Every surface of every service authenticates, and on Articuno the credential is
      // what selects the tenant: a call without one must never leave the process.
      throw new Error(`${this.service}: auth returned no X-API-Key or Bearer credential`);
    }

    const headers: Record<string, string> = { ...opts.headers };
    if (opts.userId) headers['X-User-Id'] = opts.userId;
    if (opts.requestId) headers['X-Request-Id'] = opts.requestId;
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    Object.assign(headers, credentials);

    const signals = [opts.signal, AbortSignal.timeout(timeoutMs)].filter((s): s is AbortSignal => !!s);

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}${toQueryString(query)}`, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        signal: AbortSignal.any(signals),
      });
    } catch (err) {
      this.logger.warn(`${this.service}: ${method} ${path} unreachable: ${(err as Error).message}`);
      throw new HeyAtomHttpError(this.service, 503, undefined, `${this.service} unreachable: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let parsed: unknown = text || undefined;
      try {
        parsed = JSON.parse(text);
      } catch {
        // non-JSON error body: keep the text
      }
      // Standard bodies put the validation detail in `errors[]` and a generic `message`
      // ("Validation failed"); older ones put it in `message` as an array.
      const { errors, message: raw } = (parsed ?? {}) as { errors?: unknown; message?: unknown };
      const detail = Array.isArray(errors) && errors.length ? errors : raw;
      const message = Array.isArray(detail) ? detail.join(', ') : typeof detail === 'string' ? detail : `${this.service} error ${res.status}`;
      const err = new HeyAtomHttpError(this.service, res.status, parsed, message);
      this.logger.warn(`${this.service}: ${method} ${path} failed: ${res.status}${err.requestId ? ` (requestId ${err.requestId})` : ''}`);
      throw err;
    }
    return res;
  }
}

export function toQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Builds a multipart body: `files` under `field`, scalar fields as strings, arrays as repeated fields. */
export function toFormData(field: string, files: FileInput[], fields: Record<string, unknown> = {}): FormData {
  const form = new FormData();
  for (const f of files) {
    const blob = f.data instanceof Blob ? f.data : new Blob([f.data as BlobPart], f.contentType ? { type: f.contentType } : {});
    form.append(field, blob, f.filename);
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) form.append(key, String(v));
  }
  return form;
}

/** Path segment, encoded: ids come from callers and must not be able to change the route. */
export const seg = (value: string): string => encodeURIComponent(value);
