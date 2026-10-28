import type { UmamiEventData } from './utils.js';

type UmamiWindow = { umami?: { track(event: string, data?: UmamiEventData): Promise<void> } };

/**
 * Custom events. `track` is a no-op on the server, when the module is disabled and when the
 * tracker is blocked or not loaded yet. `data-umami-event` attributes need nothing from here.
 */
export function useUmami() {
  return {
    track(event: string, data?: UmamiEventData): void {
      if (typeof window === 'undefined') return;
      (window as unknown as UmamiWindow).umami?.track(event, data).catch(() => {});
    },
  };
}
