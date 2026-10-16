import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyStandardWebhookOptions {
  /** The request body exactly as received — never a re-serialized object. */
  rawBody: Buffer | string;
  /** Request headers (any case). */
  headers: Record<string, string | string[] | undefined>;
  /** Your webhook secret (used as a UTF-8 string), plus the previous one during a rotation. */
  secrets: string | string[];
  /** Max distance of `webhook-timestamp` from now, either direction. Default 300 s. */
  toleranceSeconds?: number;
  /** For tests. */
  nowMs?: number;
}

export interface VerifiedStandardWebhook {
  /** `webhook-id`: stable across retries, dedupe on it. */
  id: string;
  /** `webhook-timestamp`, unix seconds. */
  timestamp: number;
}

function header(headers: VerifyStandardWebhookOptions['headers'], name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  const v = key === undefined ? undefined : headers[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Verifies a Standard Webhooks delivery as the platform signs it (`signStandardWebhook` of
 * `@heyatom/nest-common/webhooks`): `webhook-signature` is a space-separated list of
 * `v1,<base64 HMAC-SHA256("<id>.<timestamp>.<raw body>")>`, keyed with the secret as UTF-8.
 * Any of `secrets` matching any `v1` entry accepts (zero-downtime rotation). Returns `null`
 * on missing headers, a non-numeric or out-of-tolerance timestamp, or no match.
 */
export function verifyStandardWebhook(options: VerifyStandardWebhookOptions): VerifiedStandardWebhook | null {
  const id = header(options.headers, 'webhook-id');
  const ts = header(options.headers, 'webhook-timestamp');
  const signature = header(options.headers, 'webhook-signature');
  const secrets = (Array.isArray(options.secrets) ? options.secrets : [options.secrets]).filter(Boolean);
  if (!id || !ts || !signature || secrets.length === 0 || !/^\d+$/.test(ts)) return null;

  const timestamp = Number(ts);
  const nowS = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowS - timestamp) > (options.toleranceSeconds ?? 300)) return null;

  const received = signature
    .split(' ')
    .map((entry) => entry.split(','))
    .filter(([version, value]) => version === 'v1' && value)
    .map(([, value]) => Buffer.from(value, 'base64'));

  for (const secret of secrets) {
    const expected = createHmac('sha256', secret).update(`${id}.${ts}.`).update(options.rawBody).digest();
    if (received.some((r) => r.length === expected.length && timingSafeEqual(r, expected))) {
      return { id, timestamp };
    }
  }
  return null;
}
