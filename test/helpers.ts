export interface Call {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
}

/** A `fetch` stub: records every call and answers with whatever `answer` returns. */
export function fakeFetch(answer: (url: string, init: RequestInit) => Response = () => json(200, {})) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, headers: init.headers as Record<string, string> });
    return answer(url, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

export const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
