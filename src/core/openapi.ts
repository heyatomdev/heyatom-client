/** Type helpers over openapi-typescript `operations`: the JSON body in and out of one operation. */

type Json<R> = R extends { content: { 'application/json': infer T } } ? T : unknown;

/** The 200/201 JSON body; `void` for a bare 204; `unknown` when the service documents no schema. */
export type ResponseOf<Op> = Op extends { responses: infer R }
  ? 200 extends keyof R
    ? Json<R[200]>
    : 201 extends keyof R
      ? Json<R[201]>
      : 204 extends keyof R
        ? void
        : unknown
  : unknown;

/** The JSON request body; a loose record when the service documents none. */
export type BodyOf<Op> = Op extends { requestBody?: { content: { 'application/json': infer T } } } ? T : Record<string, unknown>;

/** The multipart fields other than the file(s). */
export type FormFieldsOf<Op> = Op extends { requestBody?: { content: { 'multipart/form-data': infer T } } }
  ? Omit<T, 'file' | 'files'>
  : Record<string, unknown>;

export type QueryOf<Op> = Op extends { parameters: { query?: infer Q } } ? ([Q] extends [never] ? never : NonNullable<Q>) : never;
