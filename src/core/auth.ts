export type AuthHeaders = Record<string, string>;
/** Returns the credential headers for one request. Called before every request, so it may rotate. */
export type AuthProvider = () => AuthHeaders | Promise<AuthHeaders>;

/**
 * `X-API-Key`: a FileHarbor client key, or an Articuno tenant key (the key selects the tenant).
 * Pair it with the per-call `userId` option for FileHarbor's `X-User-Id`.
 */
export function apiKeyAuth(apiKey: string): AuthProvider {
  if (!apiKey) throw new Error('apiKeyAuth: apiKey is empty');
  const headers = { 'X-API-Key': apiKey };
  return () => headers;
}

/** What `serviceTokenAuth` needs: `ServiceTokenProvider` from `@heyatom/bastion-client` fits as-is. */
export interface ServiceTokenSource {
  getToken(serviceSlug?: string): Promise<string>;
}

/**
 * `Authorization: Bearer <service-client JWT>` minted by Bastion for `serviceSlug`
 * (the target service's App slug, e.g. `'articuno'`). Caching and renewal are the
 * provider's job; this asks it on every request.
 */
export function serviceTokenAuth(tokens: ServiceTokenSource, serviceSlug: string): AuthProvider {
  return async () => {
    const token = await tokens.getToken(serviceSlug);
    if (!token) throw new Error('serviceTokenAuth: token provider returned an empty token');
    return { Authorization: `Bearer ${token}` };
  };
}

const anonymous: AuthProvider = () => ({});

/**
 * No credential, for anonymous surfaces (Beacon's `/public`). Only clients built for
 * such a surface accept it: any other client throws at construction, so an
 * authenticated service can never be called without a credential by mistake.
 */
export function anonymousAuth(): AuthProvider {
  return anonymous;
}

export function isAnonymousAuth(auth: AuthProvider): boolean {
  return auth === anonymous;
}
