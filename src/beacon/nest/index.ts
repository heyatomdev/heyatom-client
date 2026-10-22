import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { BeaconClient } from '../client.js';
import type { HeyAtomClientOptions } from '../../core/http.js';
import { nestLogger } from '../../nest/logger.js';
import type { ClientModuleAsyncOptions } from '../../nest/options.js';

export * from '../index.js';
export type { ClientModuleAsyncOptions } from '../../nest/options.js';
export { toHttpException } from '../../nest/errors.js';

export const BEACON_OPTIONS = Symbol('BEACON_OPTIONS');

/**
 * Provides `BeaconClient` (the anonymous `/public` surface). Global: import once in `AppModule`.
 * ```ts
 * HeyAtomBeaconModule.forRootAsync({
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     baseUrl: config.getOrThrow('BEACON_URL'),
 *     auth: anonymousAuth(),
 *   }),
 * })
 * ```
 */
@Global()
@Module({})
export class HeyAtomBeaconModule {
  static forRoot(options: HeyAtomClientOptions): DynamicModule {
    return this.build({ provide: BEACON_OPTIONS, useValue: options });
  }

  static forRootAsync(options: ClientModuleAsyncOptions): DynamicModule {
    return this.build({ provide: BEACON_OPTIONS, useFactory: options.useFactory, inject: options.inject as never[] }, options.imports);
  }

  private static build(optionsProvider: Provider, imports: DynamicModule['imports'] = []): DynamicModule {
    return {
      module: HeyAtomBeaconModule,
      imports,
      providers: [
        optionsProvider,
        {
          provide: BeaconClient,
          inject: [BEACON_OPTIONS],
          useFactory: (o: HeyAtomClientOptions) => new BeaconClient({ logger: nestLogger(BeaconClient.name), ...o }),
        },
      ],
      exports: [BeaconClient],
    };
  }
}
