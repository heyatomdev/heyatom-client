import { describe, expect, it } from 'vitest';
import { verifyStandardWebhook } from '../src/webhooks/index.js';

// Fixed vector of nest-common/docs/usage.md › "Signature test vector".
const id = 'msg_2Kx9a';
const timestamp = 1760529600;
const rawBody = '{"type":"event.created","data":{"id":"evt_1"}}';
const current = 'v1,+VYotv/AI9wyaA68bMYdRA3RDO8k9+ppDgCTYh6aJJ4=';
const previous = 'v1,TFAF/sEYytApEv9Zepsa4likR+i80NsV05Wcqt5x/5I=';
const nowMs = timestamp * 1000;
const headers = (signature: string) => ({
  'webhook-id': id,
  'webhook-timestamp': String(timestamp),
  'webhook-signature': signature,
});

describe('verifyStandardWebhook', () => {
  it('accepts the shared vector, string or Buffer body, any header case', () => {
    const ok = { id, timestamp };
    expect(verifyStandardWebhook({ rawBody, headers: headers(current), secrets: 'whsec-test-current', nowMs })).toEqual(ok);
    expect(
      verifyStandardWebhook({
        rawBody: Buffer.from(rawBody),
        headers: { 'Webhook-Id': id, 'WEBHOOK-TIMESTAMP': String(timestamp), 'Webhook-Signature': [current] },
        secrets: 'whsec-test-current',
        nowMs,
      }),
    ).toEqual(ok);
  });

  it('rotation: either secret matches either signature in the list', () => {
    const both = `${current} ${previous}`;
    expect(verifyStandardWebhook({ rawBody, headers: headers(both), secrets: 'whsec-test-previous', nowMs })).toEqual({ id, timestamp });
    expect(verifyStandardWebhook({ rawBody, headers: headers(previous), secrets: ['whsec-test-current', 'whsec-test-previous'], nowMs })).toEqual({ id, timestamp });
  });

  it('refuses a wrong secret, a tampered body or a non-v1 entry', () => {
    expect(verifyStandardWebhook({ rawBody, headers: headers(current), secrets: 'other', nowMs })).toBeNull();
    expect(verifyStandardWebhook({ rawBody: rawBody + ' ', headers: headers(current), secrets: 'whsec-test-current', nowMs })).toBeNull();
    expect(verifyStandardWebhook({ rawBody, headers: headers(current.replace('v1,', 'v2,')), secrets: 'whsec-test-current', nowMs })).toBeNull();
  });

  it('refuses a timestamp out of tolerance or not numeric', () => {
    const secrets = 'whsec-test-current';
    expect(verifyStandardWebhook({ rawBody, headers: headers(current), secrets, nowMs: nowMs + 301_000 })).toBeNull();
    expect(verifyStandardWebhook({ rawBody, headers: headers(current), secrets, nowMs: nowMs - 301_000 })).toBeNull();
    expect(verifyStandardWebhook({ rawBody, headers: headers(current), secrets, nowMs: nowMs + 301_000, toleranceSeconds: 600 })).not.toBeNull();
    expect(verifyStandardWebhook({ rawBody, headers: { ...headers(current), 'webhook-timestamp': '1760529600.0' }, secrets, nowMs })).toBeNull();
  });

  it('refuses missing headers or no secret', () => {
    for (const name of ['webhook-id', 'webhook-timestamp', 'webhook-signature'] as const) {
      const h: Record<string, string | undefined> = { ...headers(current), [name]: undefined };
      expect(verifyStandardWebhook({ rawBody, headers: h, secrets: 'whsec-test-current', nowMs })).toBeNull();
    }
    expect(verifyStandardWebhook({ rawBody, headers: headers(current), secrets: [], nowMs })).toBeNull();
  });

  it('ignores whitespace-only secrets', () => {
    expect(verifyStandardWebhook({ rawBody, headers: headers(current), secrets: [' '], nowMs })).toBeNull();
    expect(verifyStandardWebhook({ rawBody, headers: headers(current), secrets: [' ', 'whsec-test-current'], nowMs })).toEqual({ id, timestamp });
  });
});
