import type { ModuleMetadata } from '@nestjs/common';
import type { HeyAtomClientOptions } from '../core/http.js';

export interface ClientModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => HeyAtomClientOptions | Promise<HeyAtomClientOptions>;
  inject?: unknown[];
}
