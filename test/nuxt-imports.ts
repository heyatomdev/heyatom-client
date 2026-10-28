// `#imports` for the proxy under vitest: h3 plus a settable runtime config.
export * from 'h3';

let config: Record<string, unknown> = {};
export const setRuntimeConfig = (c: Record<string, unknown>) => (config = c);
export const useRuntimeConfig = (_event?: unknown) => config as never;
